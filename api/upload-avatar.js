// /api/upload-avatar.js
import cloudinary from "cloudinary";
import multer from "multer";
import fs from "fs";

// Disable default body parser for Vercel
export const config = { api: { bodyParser: false } };

// Configure Cloudinary with environment variables
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer setup: store files in memory temporarily
const storage = multer.memoryStorage();
const upload = multer({ storage }).single("file");

// Promisify multer for async/await
const uploadAsync = (req, res) =>
  new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Use POST only");
  }

  try {
    // Handle file upload
    await uploadAsync(req, res);

    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).send("Missing userId");
    }

    // Save buffer to a temporary file for Cloudinary
    const tmpFilePath = `/tmp/${Date.now()}_${req.file.originalname}`;
    await fs.promises.writeFile(tmpFilePath, req.file.buffer);

    // Upload to Cloudinary (signed)
    const result = await cloudinary.v2.uploader.upload(tmpFilePath, {
      folder: "avatars",
      public_id: `avatar_${userId}_${Date.now()}`,
      overwrite: true
    });

    // Delete temp file
    await fs.promises.unlink(tmpFilePath);

    if (!result.secure_url) {
      return res.status(500).send("Cloudinary upload failed");
    }

    // Return plain URL
    res.status(200).send(result.secure_url);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error: " + err.message);
  }
}
