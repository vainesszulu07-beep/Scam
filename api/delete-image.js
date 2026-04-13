import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { publicId } = req.body || {};

    if (!publicId) {
      return res.status(400).json({ error: "Missing publicId" });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (err) {
    console.error("Delete failed:", err);
    return res.status(500).json({ error: "Delete failed" });
  }
}
