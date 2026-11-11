
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const requestId =
    req.headers["x-request-id"] || crypto.randomUUID();

  let stage = "request_received";

  try {
    // STEP 1: Method check
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        stage: "method_check",
        message: "Method not allowed",
        request_id: requestId
      });
    }

    // STEP 2: Inspect incoming body
    stage = "body_inspection";

    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          success: false,
          stage,
          message: "Request body contains invalid JSON",
          request_id: requestId
        });
      }
    }

    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString("utf8"));
      } catch {
        return res.status(400).json({
          success: false,
          stage,
          message: "Request body contains invalid JSON",
          request_id: requestId
        });
      }
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      body = {};
    }

    const { subid, id, secret_key } = body;

    const received = {
      subid: typeof subid === "string" && !!subid.trim(),
      id: typeof id === "string" && !!id.trim(),
      secret_key:
        typeof secret_key === "string" && !!secret_key.trim()
    };

    console.log("RECEIVER BODY DIAGNOSTICS:", {
      request_id: requestId,
      content_type: req.headers["content-type"],
      body_type: typeof req.body,
      body_keys: Object.keys(body),
      received
    });

    // STEP 3: Validate incoming credentials
    stage = "input_validation";

    const invalidFields = Object.entries(received)
      .filter(([name, valid]) => !valid)
      .map(([name]) => name);

    if (invalidFields.length > 0) {
      return res.status(400).json({
        success: false,
        authorized: false,
        stage,
        message: "Required credentials are missing or invalid",
        invalid_fields: invalidFields,
        received,
        request_id: requestId
      });
    }

    // STEP 4: Check Supabase environment variables
    stage = "supabase_environment_check";

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    const missingSupabase = [];

    if (!supabaseUrl?.trim()) {
      missingSupabase.push("SUPABASE_URL");
    }

    if (!supabaseKey?.trim()) {
      missingSupabase.push("SUPABASE_SECRET_KEY");
    }

    if (missingSupabase.length > 0) {
      return res.status(500).json({
        success: false,
        authorized: false,
        stage,
        message: "Supabase environment variables are missing",
        missing: missingSupabase,
        request_id: requestId
      });
    }

    // STEP 5: Connect to Supabase
    stage = "supabase_connection";

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    console.log("SUPABASE CLIENT CREATED:", requestId);

    // STEP 6: Find application
    stage = "database_lookup";

    const { data, error } = await supabase
      .from("apps")
      .select("subid, id, secret_key")
      .eq("subid", subid)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("DATABASE LOOKUP ERROR:", {
        request_id: requestId,
        code: error.code,
        message: error.message
      });

      return res.status(500).json({
        success: false,
        authorized: false,
        stage,
        message: "Supabase database lookup failed",
        database_error: error.message,
        database_code: error.code,
        request_id: requestId
      });
    }

    if (!data) {
      return res.status(401).json({
        success: false,
        authorized: false,
        stage,
        message: "Application not found",
        diagnostics: {
          record_found: false
        },
        request_id: requestId
      });
    }

    console.log("APPLICATION FOUND:", {
      request_id: requestId,
      record_found: true,
      secret_key_available:
        typeof data.secret_key === "string"
    });

    // STEP 7: Compare secret keys
    stage = "secret_key_comparison";

    if (typeof data.secret_key !== "string") {
      return res.status(500).json({
        success: false,
        authorized: false,
        stage,
        message: "Stored secret key is missing or invalid",
        request_id: requestId
      });
    }

    const supplied = Buffer.from(secret_key, "utf8");
    const stored = Buffer.from(data.secret_key, "utf8");

    const secretMatches =
      supplied.length === stored.length &&
      crypto.timingSafeEqual(supplied, stored);

    if (!secretMatches) {
      return res.status(401).json({
        success: false,
        authorized: false,
        stage,
        message: "Secret key does not match",
        diagnostics: {
          record_found: true,
          secret_match: false
        },
        request_id: requestId
      });
    }

    // STEP 8: Generate token
    stage = "token_generation";

    const token_id = crypto.randomBytes(32).toString("hex");

    // STEP 9: Save token
    stage = "token_database_update";

    const { data: updated, error: updateError } = await supabase
      .from("apps")
      .update({ token_id })
      .eq("subid", subid)
      .eq("id", id)
      .select("token_id")
      .maybeSingle();

    if (updateError) {
      console.error("TOKEN UPDATE ERROR:", {
        request_id: requestId,
        code: updateError.code,
        message: updateError.message
      });

      return res.status(500).json({
        success: false,
        authorized: false,
        stage,
        message: "Could not save authentication token",
        database_error: updateError.message,
        database_code: updateError.code,
        request_id: requestId
      });
    }

    if (!updated) {
      return res.status(500).json({
        success: false,
        authorized: false,
        stage,
        message: "Token update returned no matching record",
        request_id: requestId
      });
    }

    // STEP 10: Success
    console.log("PARTNER AUTHENTICATED:", {
      request_id: requestId,
      record_found: true,
      secret_match: true,
      token_saved: true
    });

    return res.status(200).json({
      success: true,
      authorized: true,
      message: "Partner verified",

      token_id: updated.token_id,

      diagnostics: {
        request_received: true,
        body_valid: true,
        supabase_configured: true,
        database_connected: true,
        record_found: true,
        secret_match: true,
        token_generated: true,
        token_saved: true,
        failed_stage: null
      },

      request_id: requestId
    });

  } catch (error) {
    console.error("RECEIVER INTERNAL ERROR:", {
      request_id: requestId,
      stage,
      error: error.message
    });

    return res.status(500).json({
      success: false,
      authorized: false,
      stage,
      message: "Receiving backend encountered an internal error",
      error: error.message,
      request_id: requestId
    });
  }
}
