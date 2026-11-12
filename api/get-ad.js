import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";

// Get the trusted visitor IP supplied by Vercel.
function getVercelClientIp(req) {
  const possibleHeaders = [
    req.headers["x-real-ip"],
    req.headers["x-forwarded-for"]
  ];

  for (const header of possibleHeaders) {
    if (!header) continue;

    const value = Array.isArray(header) ? header[0] : header;

    // Use the first IP if the header contains a forwarded-IP list.
    const ip = String(value).split(",")[0].trim();

    if (isIP(ip)) {
      return ip;
    }
  }

  return null;
}


// Extract the Cloudinary video asset information from its URL.
function getCloudinaryAssetDetails(videoUrl, cloudName) {
  const parsedUrl = new URL(videoUrl);

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "res.cloudinary.com"
  ) {
    throw new Error("The advertisement URL is not a standard Cloudinary URL");
  }

  const parts = parsedUrl.pathname
    .split("/")
    .filter(Boolean)
    .map(part => decodeURIComponent(part));

  if (parts[0] !== cloudName) {
    throw new Error("Cloudinary cloud name does not match configuration");
  }

  if (parts[1] !== "video") {
    throw new Error("The Cloudinary asset is not a video");
  }

  const deliveryType = parts[2];

  if (!["upload", "private", "authenticated"].includes(deliveryType)) {
    throw new Error("Unsupported Cloudinary delivery type");
  }

  let assetParts = parts.slice(3);

  // Ignore transformation segments before the version.
  const versionIndex = assetParts.findIndex(part =>
    /^v[0-9]+$/.test(part)
  );

  if (versionIndex !== -1) {
    assetParts = assetParts.slice(versionIndex + 1);
  }

  if (assetParts.length === 0) {
    throw new Error("Cloudinary public ID could not be extracted");
  }

  // Remove the video file extension from the public ID.
  const lastPart = assetParts[assetParts.length - 1];

  const extensionMatch = lastPart.match(
    /\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg|3gp|ogv)$/i
  );

  if (!extensionMatch) {
    throw new Error("Unsupported or missing video file extension");
  }

  assetParts[assetParts.length - 1] =
    lastPart.slice(0, -extensionMatch[0].length);

  const publicId = assetParts.join("/");

  if (!publicId) {
    throw new Error("Invalid Cloudinary public ID");
  }

  return {
    deliveryType,
    publicId
  };
}


// Retrieve the original video duration from Cloudinary.
async function getCloudinaryVideoDuration(videoUrl) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary API configuration is missing");
  }

  const asset = getCloudinaryAssetDetails(videoUrl, cloudName);

  const encodedPublicId = asset.publicId
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  const metadataUrl =
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}` +
    `/resources/video/${asset.deliveryType}/${encodedPublicId}`;

  const authorization = Buffer
    .from(`${apiKey}:${apiSecret}`)
    .toString("base64");

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = await fetch(metadataUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authorization}`
      },
      signal: controller.signal
    });

    const metadata = await response.json().catch(() => null);

    if (!response.ok) {
      const cloudinaryMessage =
        metadata?.error?.message || "Unknown Cloudinary error";

      throw new Error(
        `Cloudinary metadata request failed: ${cloudinaryMessage}`
      );
    }

    const duration = Number(metadata?.duration);

    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Cloudinary returned an invalid video duration");
    }

    // Keep millisecond precision while storing seconds.
    return Number(duration.toFixed(3));

  } finally {
    clearTimeout(timeout);
  }
}


export default async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  const DEBUG = process.env.DEBUG_GET_AD === "true";

  let stage = "request_received";

  function fail(status, message, reason = null, extra = {}) {

    console.error("GET AD FAILURE:", {
      stage,
      message,
      reason,
      ...extra
    });

    const response = {
      success: false,
      authorized: false,
      stage,
      message
    };

    if (DEBUG) {
      response.reason = reason;
      response.diagnostics = extra;
    }

    return res.status(status).json(response);
  }

  try {

    // STEP 1: Check request method
    stage = "method_check";

    if (req.method !== "POST") {
      return fail(405, "Method not allowed");
    }

    // STEP 2: Read request body
    stage = "body_validation";

    let body = req.body;

    if (Buffer.isBuffer(body)) {
      body = JSON.parse(body.toString("utf8"));
    } else if (typeof body === "string") {
      body = JSON.parse(body);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return fail(400, "Invalid request body");
    }

    const token_id =
      typeof body.token_id === "string"
        ? body.token_id.trim()
        : "";

    // STEP 3: Get subid from server environment
    stage = "environment_validation";

    const subid =
      typeof process.env.PARTNER_SUBID === "string"
        ? process.env.PARTNER_SUBID.trim()
        : "";

    if (!/^[a-f0-9]{64}$/i.test(token_id)) {
      return fail(
        400,
        "Invalid token ID",
        "token_id must contain exactly 64 hexadecimal characters"
      );
    }

    if (!/^[A-F0-9]{8}$/.test(subid)) {
      return fail(
        500,
        "Invalid or missing PARTNER_SUBID environment variable",
        "PARTNER_SUBID must contain exactly 8 uppercase hexadecimal characters"
      );
    }

    // STEP 4: Check Supabase configuration
    stage = "supabase_configuration";

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      return fail(
        500,
        "Supabase configuration missing",
        "SUPABASE_URL or SUPABASE_SECRET_KEY is not configured"
      );
    }

    // STEP 5: Create Supabase client
    stage = "supabase_client_creation";

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // STEP 6: Verify session and retrieve advertisement
    stage = "rpc_execution";

    const { data, error } = await supabase.rpc(
      "get_ad_for_session",
      {
        p_token_id: token_id,
        p_subid: subid
      }
    );

    if (error) {
      return fail(
        500,
        "Supabase RPC execution failed",
        error.message,
        {
          code: error.code,
          details: error.details,
          hint: error.hint
        }
      );
    }

    // STEP 7: Check RPC response
    stage = "rpc_response_validation";

    if (!data || typeof data !== "object") {
      return fail(
        500,
        "Invalid RPC response",
        "The get_ad_for_session function returned null or invalid data"
      );
    }

    if (data.authorized !== true) {
      return res.status(401).json({
        success: false,
        authorized: false,
        stage,
        message: data.message || "Session not authorized"
      });
    }

    // STEP 8: Handle no advertisement
    stage = "advertisement_validation";

    if (!data.ad) {
      return res.status(200).json({
        success: true,
        authorized: true,
        message: "No advertisements available",
        ad: null
      });
    }

    if (
      typeof data.ad !== "object" ||
      typeof data.ad.id !== "string" ||
      !data.ad.id.trim() ||
      typeof data.ad.ad_url !== "string" ||
      !data.ad.ad_url.trim()
    ) {
      return fail(
        500,
        "Invalid advertisement data",
        "The RPC did not return a valid ad ID and video URL"
      );
    }

    // STEP 9: Get the actual duration from Cloudinary metadata
    stage = "video_metadata_retrieval";

    let timer;

    try {
      timer = await getCloudinaryVideoDuration(data.ad.ad_url);
    } catch (metadataError) {
      return fail(
        502,
        "Unable to retrieve video duration",
        metadataError.message
      );
    }

    // STEP 10: Get visitor IP from Vercel
    stage = "ip_detection";

    const ip_address = getVercelClientIp(req);

    if (!ip_address) {
      return fail(
        503,
        "Unable to identify visitor IP",
        "Vercel did not provide a valid x-real-ip or x-forwarded-for header"
      );
    }

    // STEP 11: Insert the impression into Supabase
    stage = "impression_creation";

    const { data: impressionData, error: impressionError } =
      await supabase.rpc(
        "create_ad_impression",
        {
          p_timer: timer,
          p_ip_address: ip_address,
          p_subid: subid,
          p_ad_id: data.ad.id
        }
      );

    if (impressionError) {
      return fail(
        500,
        "Failed to create advertisement impression",
        impressionError.message,
        {
          code: impressionError.code,
          details: impressionError.details,
          hint: impressionError.hint
        }
      );
    }

    const impressionId =
      typeof impressionData === "string"
        ? impressionData
        : null;

    if (
      !impressionId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(impressionId)
    ) {
      return fail(
        500,
        "Invalid impression response",
        "create_ad_impression did not return a valid impression UUID"
      );
    }

    // STEP 12: Return advertisement and its impression ID
    stage = "advertisement_response";

    return res.status(200).json({
      success: true,
      authorized: true,
      message: "Advertisement retrieved and impression created",
      impression_id: impressionId,
      ad: data.ad
    });

  } catch (error) {

    return fail(
      500,
      "Internal server error",
      error.message || String(error),
      {
        error_name: error.name || "UnknownError"
      }
    );

  }
}
