
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Allow SDKs installed on external websites.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      authorized: false,
      message: "Method not allowed"
    });
  }

  try {
    // STEP 1: Read request body
    let body = req.body;

    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString("utf8"));
      } catch {
        return res.status(400).json({
          success: false,
          authorized: false,
          message: "Invalid JSON body"
        });
      }
    } else if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({
          success: false,
          authorized: false,
          message: "Invalid JSON body"
        });
      }
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        authorized: false,
        message: "Invalid request body"
      });
    }

    // STEP 2: Extract token and subid
    const token_id =
      typeof body.token_id === "string"
        ? body.token_id.trim()
        : "";

    const subid =
      typeof body.subid === "string"
        ? body.subid.trim()
        : "";

    // Token must be 64 hexadecimal characters.
    const validToken = /^[a-f0-9]{64}$/i.test(token_id);

    // subid must be exactly 8 uppercase hexadecimal characters.
    const validSubid = /^[A-F0-9]{8}$/.test(subid);

    if (!validToken || !validSubid) {
      return res.status(400).json({
        success: false,
        authorized: false,
        message: "Invalid token or subid"
      });
    }

    // STEP 3: Check environment variables
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if (!url?.trim() || !key?.trim()) {
      return res.status(500).json({
        success: false,
        authorized: false,
        message: "Database configuration missing"
      });
    }

    // STEP 4: Connect to Supabase
    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // STEP 5: Verify token AND its owning app
    // Also reject expired sessions where time is zero.
    const { data, error } = await supabase
      .from("app_sessions")
      .select("token_id, app_id, time")
      .eq("token_id", token_id)
      .eq("app_id", subid)
      .gt("time", 0)
      .maybeSingle();

    if (error) {
      console.error("SESSION LOOKUP ERROR:", {
        code: error.code,
        message: error.message
      });

      return res.status(500).json({
        success: false,
        authorized: false,
        message: "Session verification failed"
      });
    }

    // STEP 6: Reject invalid, expired, or mismatched sessions
    if (!data) {
      return res.status(401).json({
        success: false,
        authorized: false,
        message: "Invalid, expired, or unauthorized session"
      });
    }

    // STEP 7: Successful verification
    return res.status(200).json({
      success: true,
      authorized: true,
      message: "Token and application verified",
      subid: data.app_id,
      time_remaining: data.time
    });

  } catch (error) {
    console.error("TOKEN BACKEND ERROR:", error.message);

    return res.status(500).json({
      success: false,
      authorized: false,
      message: "Internal server error"
    });
  }
}
