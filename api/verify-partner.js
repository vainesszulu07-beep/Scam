
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const incomingRequestId = req.headers["x-request-id"];

  const requestId =
    typeof incomingRequestId === "string" &&
    incomingRequestId.length <= 100
      ? incomingRequestId
      : crypto.randomUUID();

  let stage = "request_received";

  try {
    // STEP 1: Method check
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        authorized: false,
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
          authorized: false,
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
          authorized: false,
          stage,
          message: "Request body contains invalid JSON",
          request_id: requestId
        });
      }
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      body = {};
    }

    // STEP 3: Extract credentials

    // subid must be a string
    const subid =
      typeof body.subid === "string"
        ? body.subid.trim()
        : "";

    const id =
      typeof body.id === "string"
        ? body.id.trim()
        : "";

    const secret_key =
      typeof body.secret_key === "string"
        ? body.secret_key
        : "";

    // Accept ONLY 8 uppercase hexadecimal characters
    const validSubid = /^[A-F0-9]{8}$/.test(subid);

    const validId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(id);

    const received = {
      subid: validSubid,
      id: validId,
      secret_key:
        secret_key.trim().length > 0 &&
        secret_key.length <= 4096
    };

    console.log("RECEIVER BODY DIAGNOSTICS:", {
      request_id: requestId,
      content_type: req.headers["content-type"],
      body_type: typeof req.body,
      body_keys: Object.keys(body),
      received
    });

    // STEP 4: Validate incoming credentials
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

    // STEP 5: Check Supabase environment variables
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

    // STEP 6: Connect to Supabase
    stage = "supabase_connection";

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

    console.log("SUPABASE CLIENT CREATED:", requestId);

    // STEP 7: Find application
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

    // STEP 8: Compare secret keys
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

    // STEP 9: Generate authentication token
    stage = "token_generation";

    const token_id = crypto.randomBytes(32).toString("hex");

    // STEP 10: Save token in app_sessions
    stage = "token_database_insert";

    const { data: session, error: sessionError } = await supabase
      .from("app_sessions")
      .insert({
        app_id: data.subid,
        token_id: token_id
      })
      .select("id, app_id, token_id")
      .single();

    if (sessionError) {
      console.error("SESSION INSERT ERROR:", {
        request_id: requestId,
        code: sessionError.code,
        message: sessionError.message
      });

      return res.status(500).json({
        success: false,
        authorized: false,
        stage,
        message: "Could not save authentication session",
        database_code: sessionError.code,
        request_id: requestId
      });
    }

    // STEP 11: Confirm successful authentication
    console.log("PARTNER AUTHENTICATED:", {
      request_id: requestId,
      record_found: true,
      secret_match: true,
      token_generated: true,
      token_saved: true,
      session_id: session.id
    });

    return res.status(200).json({
      success: true,
      authorized: true,
      message: "Partner verified",

      token_id: session.token_id,
      session_id: session.id,

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
      request_id: requestId
    });
  }
}
