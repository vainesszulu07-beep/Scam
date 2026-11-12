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

    if (
      !/^[a-f0-9]{64}$/i.test(token_id) ||
      !/^[A-F0-9]{8}$/.test(subid)
    ) {
      return res.status(400).json({
        success: false,
        authorized: false,
        message: "Invalid credentials"
      });
    }

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

    // RPC performs its own token, subid and expiry checks.
    const { data, error } = await supabase.rpc(
      "get_ad_for_session",
      {
        p_token_id: token_id,
        p_subid: subid
      }
    );

    if (error) {
      console.error("GET AD RPC ERROR:", error.message);

      return res.status(500).json({
        success: false,
        authorized: false,
        message: "Advertisement request failed"
      });
    }

    if (!data || data.authorized !== true) {
      return res.status(401).json({
        success: false,
        authorized: false,
        message: data?.message || "Session not authorized"
      });
    }

    return res.status(200).json({
      success: true,
      authorized: true,
      message: data.ad
        ? "Advertisement retrieved"
        : "No advertisements available",
      ad: data.ad || null
    });

  } catch (error) {
    console.error("GET AD ERROR:", error.message);

    return res.status(500).json({
      success: false,
      authorized: false,
      message: "Internal server error"
    });
  }
}
