// upload-avatar.js
import { v2 as cloudinary } from "cloudinary";

// configure with .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const form = await req.formData(); // Edge-friendly way
    const file = form.get("file");
    const userId = form.get("userId");

    if (!file) return res.status(400).send("No file uploaded");
    if (!userId) return res.status(400).send("Missing userId");

    // upload to Cloudinary
    const result = await cloudinary.uploader.upload(file.stream, {
      folder: "avatars",
      public_id: `avatar_${userId}`,
      overwrite: true,
    });

    return res.status(200).send(result.secure_url);

  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).send("Cloudinary error: " + err.message);
  }
      }
