// /api/upload-avatar.js
import formidable from "formidable";
import cloudinary from "cloudinary";
import fs from "fs";

export const config = { api: { bodyParser: false } };

// Configure Cloudinary with env vars
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Use POST only");

  try {
    // ✅ Create parser
    const form = formidable({ multiples: false });

    // ✅ Parse incoming form
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
    });

    const file = files.file;
    if (!file) return res.status(400).send("No file uploaded");

    const userId = fields.userId;
    if (!userId) return res.status(400).send("Missing userId");

    if (!fs.existsSync(file.filepath)) {
      return res.status(400).send("Uploaded file not found on server");
    }

    // ✅ Upload to Cloudinary signed
    const uploadResult = await cloudinary.v2.uploader.upload(file.filepath, {
      folder: "avatars",
      public_id: `avatar_${userId}_${Date.now()}`,
      overwrite: true
    });

    if (!uploadResult.secure_url) {
      return res.status(500).send("Cloudinary upload failed");
    }

    // ✅ Return plain URL
    res.status(200).send(uploadResult.secure_url);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error: " + err.message);
  }
      }
