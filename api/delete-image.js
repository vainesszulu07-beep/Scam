import cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("POST only");
  }

  const { publicId } = req.body || {};

  if (!publicId) {
    return res.status(400).json({ success: false, error: "Missing publicId" });
  }

  try {
    const result = await cloudinary.v2.uploader.destroy(publicId);

    // 🔥 IMPORTANT: check Cloudinary response
    if (result.result !== "ok") {
      return res.status(400).json({
        success: false,
        error: "Delete failed",
        cloudinaryResult: result.result
      });
    }

    return res.status(200).json({
      success: true,
      deleted: publicId
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Delete failed",
      details: err.message
    });
  }
}
