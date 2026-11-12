
import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";

// --------------------------------------------------
// 1. Get the visitor IP from Vercel
// --------------------------------------------------

function getVercelClientIp(req) {
  const headers = [
    req.headers["x-real-ip"],
    req.headers["x-forwarded-for"]
  ];

  for (const header of headers) {
    if (!header) continue;

    const value = Array.isArray(header)
      ? header[0]
      : header;

    const candidates = String(value).split(",");

    for (const candidate of candidates) {
      const ip = candidate.trim();

      if (isIP(ip)) {
        return ip;
      }
    }
  }

  return null;
}


// --------------------------------------------------
// 2. Extract Cloudinary information from video URL
// --------------------------------------------------

function getCloudinaryAssetDetails(videoUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(videoUrl);
  } catch {
    throw new Error("Invalid advertisement video URL");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "res.cloudinary.com"
  ) {
    throw new Error("Video URL is not a Cloudinary HTTPS URL");
  }

  const parts = parsedUrl.pathname
    .split("/")
    .filter(Boolean)
    .map(part => decodeURIComponent(part));

  const cloudNameFromUrl = parts[0];
  const resourceType = parts[1];
  const deliveryType = parts[2];

  const configuredCloudName =
    process.env.CLOUDINARY_CLOUD_NAME?.trim();

  if (!configuredCloudName) {
    throw new Error("CLOUDINARY_CLOUD_NAME is missing");
  }

  if (cloudNameFromUrl !== configuredCloudName) {
    throw new Error(
      "Cloudinary cloud name in URL does not match Vercel configuration"
    );
  }

  if (resourceType !== "video") {
    throw new Error("Cloudinary resource type must be video");
  }

  if (!["upload", "private", "authenticated"].includes(deliveryType)) {
    throw new Error("Unsupported Cloudinary delivery type");
  }

  let assetParts = parts.slice(3);

  // Locate the Cloudinary version segment.
  const versionIndex = assetParts.findIndex(part =>
    /^v[0-9]+$/.test(part)
  );

  if (versionIndex > 0) {
    throw new Error(
      "Transformed video URLs are not supported for duration lookup. Use the original video URL."
    );
  }

  if (versionIndex === 0) {
    assetParts = assetParts.slice(1);
  }

  if (assetParts.length === 0) {
    throw new Error("Cloudinary public ID is missing");
  }

  // Remove the file extension from the public ID.
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
    cloudName: configuredCloudName,
    resourceType,
    deliveryType,
    publicId
  };
}


// --------------------------------------------------
// 3. Obtain actual video duration from Cloudinary
// --------------------------------------------------

async function getCloudinaryVideoDuration(videoUrl) {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET is missing"
    );
  }

  const asset = getCloudinaryAssetDetails(videoUrl);

  // Encode each public ID segment but preserve folder separators.
  const encodedPublicId = asset.publicId
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");

  // Cloudinary Admin API: get one resource by public ID.
  const metadataUrl =
    `https://api.cloudinary.com/v1_1/` +
    `${encodeURIComponent(asset.cloudName)}` +
    `/resources/${asset.resourceType}` +
    `/${asset.deliveryType}/${encodedPublicId}`;

  const authorization = Buffer
    .from(`${apiKey}:${apiSecret}`)
    .toString("base64");

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(metadataUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: "application/json"
      },
      signal: controller.signal
    });

    const responseText = await response.text();

    let metadata = null;

    try {
      metadata = JSON.parse(responseText);
    } catch {
      // Some authentication failures can return HTML.
    }

    if (!response.ok) {
      const apiMessage =
        metadata?.error?.message ||
        responseText.slice(0, 400) ||
        response.statusText;

      throw new Error(
        `Cloudinary Admin API returned HTTP ${response.status}: ${apiMessage}`
      );
    }

    if (!metadata || typeof metadata !== "object") {
      throw new Error(
        "Cloudinary returned an invalid metadata response"
      );
    }

    // Check that Cloudinary returned the requested asset.
    if (
      metadata.public_id &&
      metadata.public_id !== asset.publicId
    ) {
      throw new Error(
        "Cloudinary returned a different public ID"
      );
    }

    const duration = Number(metadata.duration);

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      throw new Error(
        "Cloudinary metadata did not contain a valid video duration. Returned fields: " +
        Object.keys(metadata).join(", ")
      );
    }

    // Return seconds, retaining up to 3 decimal places.
    return Number(duration.toFixed(3));

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Cloudinary metadata request timed out");
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}


// --------------------------------------------------
// 4. Main API handler
// --------------------------------------------------

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

    // STEP 1: Check request method.
    stage = "method_check";

    if (req.method !== "POST") {
      return fail(405, "Method not allowed");
    }


    // STEP 2: Read request body.
    stage = "body_validation";

    let body = req.body;

    try {
      if (Buffer.isBuffer(body)) {
        body = JSON.parse(body.toString("utf8"));
      } else if (typeof body === "string") {
        body = JSON.parse(body);
      }
    } catch {
      return fail(400, "Request body contains invalid JSON");
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


    // STEP 3: Validate publisher subid.
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
        "Invalid or missing PARTNER_SUBID",
        "PARTNER_SUBID must contain exactly 8 uppercase hexadecimal characters"
      );
    }


    // STEP 4: Validate Supabase configuration.
    stage = "supabase_configuration";

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return fail(
        500,
        "Supabase configuration missing",
        "SUPABASE_URL or SUPABASE_SECRET_KEY is not configured"
      );
    }


    // STEP 5: Create Supabase client.
    stage = "supabase_client_creation";

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );


    // STEP 6: Verify session and retrieve advertisement.
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


    // STEP 7: Validate RPC response.
    stage = "rpc_response_validation";

    if (!data || typeof data !== "object") {
      return fail(
        500,
        "Invalid RPC response",
        "get_ad_for_session returned null or invalid data"
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


    // STEP 8: Handle no available advertisement.
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


    // STEP 9: Obtain actual video duration.
    stage = "video_metadata_retrieval";

    let timer;

    try {
      timer = await getCloudinaryVideoDuration(data.ad.ad_url);
    } catch (metadataError) {
      return fail(
        502,
        "Unable to retrieve video duration",
        metadataError.message,
        {
          video_url: DEBUG ? data.ad.ad_url : undefined
        }
      );
    }


    // STEP 10: Get visitor IP from Vercel.
    stage = "ip_detection";

    const ip_address = getVercelClientIp(req);

    if (!ip_address) {
      return fail(
        503,
        "Unable to identify visitor IP",
        "No valid Vercel client IP header was found"
      );
    }


    // STEP 11: Create impression row.
    stage = "impression_creation";

    const {
      data: impressionData,
      error: impressionError
    } = await supabase.rpc(
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


    // STEP 12: Validate returned impression ID.
    stage = "impression_response_validation";

    const impressionId =
      typeof impressionData === "string"
        ? impressionData
        : null;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      !impressionId ||
      !uuidPattern.test(impressionId)
    ) {
      return fail(
        500,
        "Invalid impression response",
        "create_ad_impression did not return a valid UUID"
      );
    }


    // STEP 13: Return advertisement.
    stage = "advertisement_response";

    return res.status(200).json({
      success: true,
      authorized: true,
      message: "Advertisement retrieved and impression created",
      impression_id: impressionId,
      timer: timer,
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
