
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    // Supabase credentials
    const supabaseUrl = process.env.SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        message: "Supabase environment variables are missing"
      });
    }

    // Read browser information
    const {
      impression_id,
      visibility_state,
      visible_ratio
    } = req.body || {};

    // Validate impression ID
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof impression_id !== "string" ||
      !uuidPattern.test(impression_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid impression ID"
      });
    }

    // Validate visibility state
    if (
      typeof visibility_state !== "string" ||
      !["visible", "hidden"].includes(
        visibility_state.toLowerCase()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid visibility state"
      });
    }

    // Validate visible ratio
    if (
      typeof visible_ratio !== "number" ||
      !Number.isFinite(visible_ratio) ||
      visible_ratio < 0 ||
      visible_ratio > 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid visibility ratio"
      });
    }

    // Call Supabase RPC function
    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/mark_ad_request_if_visible`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          p_impression_id: impression_id,
          p_visibility_state: visibility_state.toLowerCase(),
          p_visible_ratio: visible_ratio
        })
      }
    );

    const result = await rpcResponse.json();

    if (!rpcResponse.ok) {
      return res.status(502).json({
        success: false,
        message: "Supabase function call failed",
        error: result
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("Visibility verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}
