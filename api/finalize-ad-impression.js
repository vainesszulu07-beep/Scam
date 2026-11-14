
import { createClient } from "@supabase/supabase-js";

// ============================================
// 1. SUPABASE CONNECTION
// ============================================

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


// ============================================
// 2. BACKEND ENDPOINT
// ============================================

export default async function handler(req, res) {

  // Only accept POST requests.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }


  // Check Supabase configuration.
  if (!supabase) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error"
    });
  }


  try {

    // ========================================
    // 3. READ REQUEST BODY
    // ========================================

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


    // ========================================
    // 4. EXTRACT PARAMETERS
    // ========================================

    const {
      impression_id,
      ad_id,
      subid,
      placement,
      click
    } = body;


    // ========================================
    // 5. VALIDATE INPUT
    // ========================================

    if (
      typeof impression_id !== "string" ||
      !impression_id.trim() ||

      typeof ad_id !== "string" ||
      !ad_id.trim() ||

      typeof subid !== "string" ||
      !/^[A-F0-9]{8}$/.test(subid) ||

      typeof placement !== "string" ||
      !placement.trim() ||

      typeof click !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid report information"
      });
    }


    // ========================================
    // 6. CALL SUPABASE FUNCTION
    // ========================================

    const { data, error } = await supabase.rpc(
      "finalize_ad_impression",
      {
        p_impression_id: impression_id.trim(),
        p_ad_id: ad_id.trim(),
        p_subid: subid,
        p_placement: placement.trim(),
        p_click: click
      }
    );


    // ========================================
    // 7. HANDLE SUPABASE ERRORS
    // ========================================

    if (error) {

      console.error(
        "Finalize impression RPC error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Could not finalize impression"
      });
    }


    // ========================================
    // 8. RETURN FUNCTION RESULT
    // ========================================

    return res.status(200).json(data);

  } catch (error) {

    console.error(
      "Finalize impression backend error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}
