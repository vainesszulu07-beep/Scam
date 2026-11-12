
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
    // STEP 1: Get token
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    if (Buffer.isBuffer(body)) {
      body = JSON.parse(body.toString("utf8"));
    }

    const token_id =
      typeof body?.token_id === "string"
        ? body.token_id.trim()
        : "";

    if (!/^[a-f0-9]{64}$/i.test(token_id)) {
      return res.status(400).json({
        success: false,
        authorized: false,
        message: "Invalid token format"
      });
    }

    // STEP 2: Check environment variables
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      return res.status(500).json({
        success: false,
        authorized: false,
        message: "Database configuration missing"
      });
    }

    // STEP 3: Connect to Supabase
    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // STEP 4: Find token in apps table
    const { data, error } = await supabase
      .from("apps")
      .select("token_id")
      .eq("token_id", token_id)
      .maybeSingle();

    if (error) {
      console.error("TOKEN LOOKUP ERROR:", error.message);

      return res.status(500).json({
        success: false,
        authorized: false,
        message: "Token verification failed"
      });
    }

    // STEP 5: Check result
    if (!data) {
      return res.status(401).json({
        success: false,
        authorized: false,
        message: "Invalid or revoked token"
      });
    }

    // STEP 6: Success
    return res.status(200).json({
      success: true,
      authorized: true,
      message: "Token verified"
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
