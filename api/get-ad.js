
import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";

// --------------------------------------------------
// 1. GET VISITOR IP FROM VERCEL
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
// 2. SERIALIZE COMPLETE SUPABASE ERROR
// --------------------------------------------------

function serializeSupabaseError(error) {
  if (!error) {
    return {
      error_received: false
    };
  }

  const result = {};

  // Capture all own properties that are accessible.
  for (const key of Reflect.ownKeys(error)) {
    if (typeof key !== "string") continue;

    try {
      const value = error[key];

      if (typeof value !== "function") {
        result[key] = value;
      }
    } catch {
      result[key] = "[Unable to read property]";
    }
  }

  // Explicitly preserve important PostgREST fields.
  const importantFields = [
    "name",
    "message",
    "code",
    "details",
    "hint",
    "status",
    "statusText"
  ];

  for (const key of importantFields) {
    try {
      if (error[key] !== undefined) {
        result[key] = error[key];
      }
    } catch {
      // Preserve any fields already collected.
    }
  }

  return result;
}


// --------------------------------------------------
// 3. EXTRACT CLOUDINARY INFORMATION
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
    throw new Error(
      "Video URL is not a Cloudinary HTTPS URL"
    );
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
    throw new Error(
      "Cloudinary resource type must be video"
    );
  }

  if (
    !["upload", "private", "authenticated"].includes(
      deliveryType
    )
  ) {
    throw new Error(
      "Unsupported Cloudinary delivery type"
    );
  }

  let assetParts = parts.slice(3);

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

  const lastPart = assetParts[assetParts.length - 1];

  const extensionMatch = lastPart.match(
    /\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg|3gp|ogv)$/i
  );

  if (!extensionMatch) {
    throw new Error(
      "Unsupported or missing video file extension"
    );
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
// 4. GET ACTUAL VIDEO DURATION FROM CLOUDINARY
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

  const encodedPublicId = asset.publicId
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");

  const metadataUrl = new URL(
    `https://api.cloudinary.com/v1_1/` +
    `${encodeURIComponent(asset.cloudName)}` +
    `/resources/${asset.resourceType}` +
    `/${asset.deliveryType}/${encodedPublicId}`
  );

  metadataUrl.searchParams.set(
    "media_metadata",
    "true"
  );

  const authorization = Buffer
    .from(`${apiKey}:${apiSecret}`)
    .toString("base64");

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  try {
    const response = await fetch(
      metadataUrl.toString(),
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${authorization}`,
          Accept: "application/json"
        },
        signal: controller.signal
      }
    );

    const responseText = await response.text();

    let metadata = null;

    try {
      metadata = JSON.parse(responseText);
    } catch {
      // The response may not be JSON.
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

    if (
      !metadata ||
      typeof metadata !== "object"
    ) {
      throw new Error(
        "Cloudinary returned an invalid metadata response"
      );
    }

    if (
      metadata.public_id &&
      metadata.public_id !== asset.publicId
    ) {
      throw new Error(
        "Cloudinary returned a different public ID"
      );
    }

    const rawDuration =
      metadata.duration ??
      metadata.video_metadata?.duration ??
      metadata.format_duration ??
      metadata.video_duration;

    const duration = Number(rawDuration);

    if (
      !Number.isFinite(duration) ||
      duration <= 0
    ) {
      throw new Error(
        "Cloudinary metadata did not contain a valid video duration. Returned fields: " +
        Object.keys(metadata).join(", ")
      );
    }

    return Number(duration.toFixed(3));

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(
        "Cloudinary metadata request timed out"
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}


// --------------------------------------------------
// 5. MAIN API HANDLER
// --------------------------------------------------

export default async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  const DEBUG =
    process.env.DEBUG_GET_AD === "true";

  let stage = "request_received";


  // ------------------------------------------------
  // FAILURE HANDLER
  // ------------------------------------------------

  function fail(
    status,
    message,
    reason = null,
    extra = {}
  ) {

    const failure = {
      stage,
      status,
      message,
      reason,
      ...extra
    };

    // Always log full diagnostics in Vercel.
    console.error(
      "========================================"
    );

    console.error(
      "GET AD API FAILURE"
    );

    console.error(
      JSON.stringify(failure, null, 2)
    );

    console.error(
      "========================================"
    );

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

    // ----------------------------------------------
    // STEP 1: REQUEST METHOD
    // ----------------------------------------------

    stage = "method_check";

    if (req.method !== "POST") {
      return fail(
        405,
        "Method not allowed"
      );
    }


    // ----------------------------------------------
    // STEP 2: REQUEST BODY
    // ----------------------------------------------

    stage = "body_validation";

    let body = req.body;

    try {
      if (Buffer.isBuffer(body)) {
        body = JSON.parse(
          body.toString("utf8")
        );

      } else if (typeof body === "string") {
        body = JSON.parse(body);
      }

    } catch {
      return fail(
        400,
        "Request body contains invalid JSON"
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return fail(
        400,
        "Invalid request body"
      );
    }

    const token_id =
      typeof body.token_id === "string"
        ? body.token_id.trim()
        : "";


    // ----------------------------------------------
    // STEP 3: VALIDATE TOKEN AND SUBID
    // ----------------------------------------------

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


    // ----------------------------------------------
    // STEP 4: SUPABASE CONFIGURATION
    // ----------------------------------------------

    stage = "supabase_configuration";

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return fail(
        500,
        "Supabase configuration missing",
        "SUPABASE_URL or SUPABASE_SECRET_KEY is not configured"
      );
    }


    // ----------------------------------------------
    // STEP 5: CREATE SUPABASE CLIENT
    // ----------------------------------------------

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


    // ----------------------------------------------
    // STEP 6: VERIFY SESSION AND GET AD
    // ----------------------------------------------

    stage = "get_ad_for_session_rpc";

    const {
      data,
      error
    } = await supabase.rpc(
      "get_ad_for_session",
      {
        p_token_id: token_id,
        p_subid: subid
      }
    );

    if (error) {
      const supabaseError =
        serializeSupabaseError(error);

      return fail(
        500,
        "Supabase get_ad_for_session RPC failed",
        error.message,
        {
          supabase_error: supabaseError
        }
      );
    }


    // ----------------------------------------------
    // STEP 7: VALIDATE RPC RESPONSE
    // ----------------------------------------------

    stage = "rpc_response_validation";

    if (
      !data ||
      typeof data !== "object"
    ) {
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
        message:
          data.message ||
          "Session not authorized"
      });
    }


    // ----------------------------------------------
    // STEP 8: VALIDATE ADVERTISEMENT
    // ----------------------------------------------

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


    // ----------------------------------------------
    // STEP 9: GET VIDEO DURATION
    // ----------------------------------------------

    stage = "video_metadata_retrieval";

    let timer;

    try {
      timer = await getCloudinaryVideoDuration(
        data.ad.ad_url
      );

    } catch (metadataError) {
      return fail(
        502,
        "Unable to retrieve video duration",
        metadataError.message,
        {
          error_name: metadataError.name || "Error",
          video_url: DEBUG
            ? data.ad.ad_url
            : undefined
        }
      );
    }


    // ----------------------------------------------
    // STEP 10: GET VISITOR IP
    // ----------------------------------------------

    stage = "ip_detection";

    const ip_address =
      getVercelClientIp(req);

    if (!ip_address) {
      return fail(
        503,
        "Unable to identify visitor IP",
        "No valid Vercel client IP header was found"
      );
    }


    // ----------------------------------------------
    // STEP 11: CREATE AD IMPRESSION
    // ----------------------------------------------

    stage = "create_ad_impression_rpc";

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

      const supabaseError =
        serializeSupabaseError(impressionError);

      return fail(
        500,
        "Failed to create advertisement impression",
        impressionError.message,
        {
          supabase_error: supabaseError,
          attempted_parameters: DEBUG
            ? {
                p_timer: timer,
                p_ip_address: ip_address,
                p_subid: subid,
                p_ad_id: data.ad.id
              }
            : undefined
        }
      );
    }


    // ----------------------------------------------
    // STEP 12: VALIDATE IMPRESSION UUID
    // ----------------------------------------------

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
        "create_ad_impression did not return a valid UUID",
        {
          returned_data: impressionData
        }
      );
    }


    // ----------------------------------------------
    // STEP 13: SUCCESS
    // ----------------------------------------------

    stage = "advertisement_response";

    return res.status(200).json({
      success: true,
      authorized: true,
      message:
        "Advertisement retrieved and impression created",
      impression_id: impressionId,
      timer,
      ad: data.ad
    });


  } catch (error) {

    const unexpectedError = {
      name: error.name || "UnknownError",
      message: error.message || String(error),
      stack: DEBUG ? error.stack : undefined
    };

    return fail(
      500,
      "Internal server error",
      error.message || String(error),
      {
        unexpected_error: unexpectedError
      }
    );

  }
}
