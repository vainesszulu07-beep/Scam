
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const { id, secret_key } = req.body || {};

    if (
      typeof id !== "string" ||
      typeof secret_key !== "string" ||
      !id ||
      !secret_key
    ) {
      return res.status(400).json({
        success: false,
        message: "ID and secret key are required"
      });
    }

    const { data, error } = await supabase
      .from("apps")
      .select("id, secret_key")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!data || typeof data.secret_key !== "string") {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const supplied = Buffer.from(secret_key, "utf8");
    const stored = Buffer.from(data.secret_key, "utf8");

    if (
      supplied.length !== stored.length ||
      !crypto.timingSafeEqual(supplied, stored)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    return res.status(200).json({
      success: true,
      authorized: true,
      message: "Partner verified"
    });

  } catch (error) {
    console.error("Verification error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
