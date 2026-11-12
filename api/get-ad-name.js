
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      authorized: false,
      message: "Method not allowed"
    });
  }

  try {

    let body = req.body;

    if (Buffer.isBuffer(body)) {
      body = JSON.parse(body.toString("utf8"));
    } else if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const token_id =
      typeof body?.token_id === "string"
        ? body.token_id.trim()
        : "";

    const subid =
      typeof body?.subid === "string"
        ? body.subid.trim()
        : "";

    const ad_id =
      typeof body?.ad_id === "string"
        ? body.ad_id.trim()
        : "";

    // Validate request
    if (
      !/^[a-f0-9]{64}$/i.test(token_id) ||
      !/^[A-F0-9]{8}$/.test(subid) ||
      !ad_id ||
      ad_id.length > 128
    ) {
      return res.status(400).json({
        success: false,
        authorized: false,
        message: "Invalid request credentials"
      });
    }

    // Check Supabase configuration
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      return res.status(500).json({
        success: false,
        authorized: false,
        message: "Database configuration missing"
      });
    }

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Call the protected RPC
    const { data, error } = await supabase.rpc(
      "get_ad_app_name_for_session",
      {
        p_token_id: token_id,
        p_subid: subid,
        p_ad_id: ad_id
      }
    );

    if (error) {
      console.error("APP NAME RPC ERROR:", error.message);

      return res.status(500).json({
        success: false,
        authorized: false,
        message: "Advertisement name lookup failed"
      });
    }

    if (!data || data.authorized !== true) {
      return res.status(401).json({
        success: false,
        authorized: false,
        message: data?.message || "Session not authorized"
      });
    }

    if (data.found !== true) {
      return res.status(404).json({
        success: false,
        authorized: true,
        message: data.message || "Advertisement not found"
      });
    }

    if (
      typeof data.app_name !== "string" ||
      !data.app_name.trim()
    ) {
      return res.status(422).json({
        success: false,
        authorized: true,
        message: "Advertisement name is missing"
      });
    }

    return res.status(200).json({
      success: true,
      authorized: true,
      ad_id,
      app_name: data.app_name.trim()
    });

  } catch (error) {

    console.error("GET AD NAME ERROR:", error.message);

    return res.status(500).json({
      success: false,
      authorized: false,
      message: "Internal server error"
    });

  }
}
