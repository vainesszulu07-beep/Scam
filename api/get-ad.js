
import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";

const DEBUG = process.env.DEBUG_GET_AD === "true";

// --------------------------------------------------
// 1. Get visitor IP
// --------------------------------------------------

function getVisitorIP(req) {
  const realIP = req.headers["x-real-ip"];

  if (typeof realIP === "string" && isIP(realIP.trim())) {
    return realIP.trim();
  }

  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    for (const item of String(forwarded).split(",")) {
      const ip = item.trim();

      if (isIP(ip)) return ip;
    }
  }

  return null;
}

// --------------------------------------------------
// 2. Get Cloudinary asset information
// --------------------------------------------------

function getCloudinaryAsset(videoURL) {
  const url = new URL(videoURL);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com"
  ) {
    throw new Error("Invalid Cloudinary video URL");
  }

  const parts = url.pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  const cloudName = parts[0];
  const resourceType = parts[1];
  const deliveryType = parts[2];

  if (cloudName !== process.env.CLOUDINARY_CLOUD_NAME?.trim()) {
    throw new Error("Cloudinary cloud name mismatch");
  }

  if (resourceType !== "video") {
    throw new Error("Resource type is not video");
  }

  if (!["upload", "private", "authenticated"].includes(deliveryType)) {
    throw new Error("Unsupported Cloudinary delivery type");
  }

  let assetParts = parts.slice(3);

  const versionIndex = assetParts.findIndex(part =>
    /^v[0-9]+$/.test(part)
  );

  if (versionIndex > 0) {
    throw new Error("Transformed video URL is not supported");
  }

  if (versionIndex === 0) {
    assetParts.shift();
  }

  if (!assetParts.length) {
    throw new Error("Cloudinary public ID is missing");
  }

  const last = assetParts.length - 1;

  assetParts[last] = assetParts[last].replace(
    /\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg|3gp|ogv)$/i,
    ""
  );

  if (!assetParts[last]) {
    throw new Error("Invalid video file name");
  }

  return {
    cloudName,
    resourceType,
    deliveryType,
    publicId: assetParts.join("/")
  };
}

// --------------------------------------------------
// 3. Get actual Cloudinary video duration
// --------------------------------------------------

async function getVideoDuration(videoURL) {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("Cloudinary API credentials are missing");
  }

  const asset = getCloudinaryAsset(videoURL);

  const publicId = asset.publicId
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const metadataURL = new URL(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(asset.cloudName)}` +
    `/resources/${asset.resourceType}/${asset.deliveryType}/${publicId}`
  );

  metadataURL.searchParams.set("media_metadata", "true");

  const authorization = Buffer
    .from(`${apiKey}:${apiSecret}`)
    .toString("base64");

  const response = await fetch(metadataURL, {
    headers: {
      Authorization: `Basic ${authorization}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(15000)
  });

  const text = await response.text();

  let metadata;

  try {
    metadata = JSON.parse(text);
  } catch {
    throw new Error(
      `Cloudinary returned invalid JSON: ${text.slice(0, 300)}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Cloudinary HTTP ${response.status}: ${
        metadata?.error?.message || text.slice(0, 300)
      }`
    );
  }

  if (
    metadata.public_id &&
    metadata.public_id !== asset.publicId
  ) {
    throw new Error("Cloudinary returned a different public ID");
  }

  const duration = Number(
    metadata.duration ??
    metadata.video_metadata?.duration ??
    metadata.format_duration ??
    metadata.video_duration
  );

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(
      `Invalid video duration. Returned fields: ${
        Object.keys(metadata).join(", ")
      }`
    );
  }

  return Number(duration.toFixed(3));
}

// --------------------------------------------------
// 4. Main API
// --------------------------------------------------

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  let stage = "starting";

  function fail(status, message, error = null) {
    const diagnostic = error
      ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      : null;

    console.error("GET AD ERROR:", {
      stage,
      message,
      error: diagnostic
    });

    return res.status(status).json({
      success: false,
      stage,
      message,
      ...(DEBUG && diagnostic
        ? { database_error: diagnostic }
        : {})
    });
  }

  try {
    // Check request
    stage = "request_validation";

    if (req.method !== "POST") {
      return fail(405, "POST method required");
    }

    let body = req.body;

    if (Buffer.isBuffer(body)) {
      body = JSON.parse(body.toString("utf8"));
    } else if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const token_id = body?.token_id?.trim();

    const subid = process.env.PARTNER_SUBID?.trim();

    if (!/^[a-f0-9]{64}$/i.test(token_id || "")) {
      return fail(400, "Invalid token ID");
    }

    if (!/^[A-F0-9]{8}$/.test(subid || "")) {
      return fail(500, "Invalid PARTNER_SUBID");
    }

    // Supabase
    stage = "supabase_connection";

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SECRET_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Get authorized advertisement
    stage = "get_ad_for_session";

    const { data, error } = await supabase.rpc(
      "get_ad_for_session",
      {
        p_token_id: token_id,
        p_subid: subid
      }
    );

    if (error) {
      return fail(500, "Advertisement retrieval failed", error);
    }

    if (!data?.authorized) {
      return res.status(401).json({
        success: false,
        stage,
        message: data?.message || "Session not authorized"
      });
    }

    if (!data.ad) {
      return res.status(200).json({
        success: true,
        message: "No advertisement available",
        ad: null
      });
    }

    if (!data.ad.id || !data.ad.ad_url) {
      return fail(500, "Advertisement ID or video URL is missing");
    }

    // Get actual video duration
    stage = "get_video_duration";

    const timer = await getVideoDuration(data.ad.ad_url);

    // Get visitor IP
    stage = "get_visitor_ip";

    const ip_address = getVisitorIP(req);

    if (!ip_address) {
      return fail(400, "Could not identify visitor IP");
    }

    // Create impression
    stage = "create_ad_impression";

    const { data: impressionID, error: impressionError } =
      await supabase.rpc("create_ad_impression", {
        p_timer: timer,
        p_ip_address: ip_address,
        p_subid: subid,
        p_ad_id: data.ad.id
      });

    if (impressionError) {
      return fail(
        500,
        "Failed to create advertisement impression",
        impressionError
      );
    }

    // Verify returned ID
    stage = "validate_impression_id";

    if (
      typeof impressionID !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(impressionID)
    ) {
      return fail(500, "Database did not return a valid impression ID");
    }

    // Success
    return res.status(200).json({
      success: true,
      message: "Impression created successfully",
      impression_id: impressionID,
      timer,
      ad: data.ad
    });

  } catch (error) {
    return fail(500, "Advertisement request failed", error);
  }
}
