
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const { subid, id, secret_key } = req.body || {};

    if (
      typeof subid !== "string" ||
      typeof id !== "string" ||
      typeof secret_key !== "string" ||
      !subid ||
      !id ||
      !secret_key
    ) {
      return res.status(400).json({
        success: false,
        message: "Subid, ID and secret key are required"
      });
    }

    // Find the exact registered application
    const { data, error } = await supabase
      .from("apps")
      .select("subid, id, secret_key")
      .eq("subid", subid)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!data || typeof data.secret_key !== "string") {
      return res.status(401).json({
        success: false,
        authorized: false,
        message: "Invalid credentials"
      });
    }

    // Verify secret key
    const supplied = Buffer.from(secret_key, "utf8");
    const stored = Buffer.from(data.secret_key, "utf8");

    if (
      supplied.length !== stored.length ||
      !crypto.timingSafeEqual(supplied, stored)
    ) {
      return res.status(401).json({
        success: false,
        authorized: false,
        message: "Invalid credentials"
      });
    }

    // Generate a cryptographically random 64-character token
    const token_id = crypto.randomBytes(32).toString("hex");

    // Save token in the verified application's row
    const { data: updated, error: updateError } = await supabase
      .from("apps")
      .update({ token_id })
      .eq("subid", subid)
      .eq("id", id)
      .select("token_id")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      throw new Error("Token could not be saved");
    }

    // Return token to requesting partner backend
    return res.status(200).json({
      success: true,
      authorized: true,
      message: "Partner verified",
      token_id: updated.token_id
    });

  } catch (error) {
    console.error("Verification error:", error.message);

    return res.status(500).json({
      success: false,
      authorized: false,
      message: "Internal server error"
    });
  }
};
