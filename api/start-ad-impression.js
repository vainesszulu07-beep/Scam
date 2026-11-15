
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  if (!supabase) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error"
    });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body"
      });
    }

    const { impression_id } = body;

    if (
      typeof impression_id !== "string" ||
      !UUID_PATTERN.test(impression_id.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid impression ID"
      });
    }

    const { data, error } = await supabase.rpc(
      "mark_ad_impression_started",
      {
        p_impression_id: impression_id.trim()
      }
    );

    if (error) {
      console.error(
        "Start impression RPC error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not mark impression as started"
      });
    }

    return res.status(data?.success === true ? 200 : 400).json(data);

  } catch (error) {
    console.error(
      "Start impression backend error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}
