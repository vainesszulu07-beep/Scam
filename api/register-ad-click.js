
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

    const {
      impression_id,
      ad_id,
      subid
    } = body;

    if (
      typeof impression_id !== "string" ||
      !UUID_PATTERN.test(impression_id.trim()) ||

      typeof ad_id !== "string" ||
      !ad_id.trim() ||

      typeof subid !== "string" ||
      !/^[A-F0-9]{8}$/.test(subid)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid click information"
      });
    }

    const { data, error } = await supabase.rpc(
      "register_ad_impression_click",
      {
        p_impression_id: impression_id.trim(),
        p_ad_id: ad_id.trim(),
        p_subid: subid
      }
    );

    if (error) {
      console.error(
        "Register click RPC error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not register click"
      });
    }

    // A limit rejection is a valid RPC response.
    // It is not a server error.
    return res.status(data?.success === true ? 200 : 400).json(data);

  } catch (error) {
    console.error(
      "Register click backend error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}
