import cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("POST only");

  const { publicId } = req.body;
  if (!publicId) return res.status(400).send("Missing publicId");

  try {
    await cloudinary.v2.uploader.destroy(publicId);
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).send("Delete failed");
  }
}
