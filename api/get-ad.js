
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  // Enable detailed error responses during debugging.
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

    if (!body || typeof body !== "object") {
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

    // STEP 6: Call the RPC
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
        "The get_ad_for_session function returned null or an invalid response"
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

    // STEP 8: Return advertisement
    stage = "advertisement_response";

    return res.status(200).json({
      success: true,
      authorized: true,
      message: data.ad
        ? "Advertisement retrieved successfully"
        : "No advertisements available",
      ad: data.ad || null
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
