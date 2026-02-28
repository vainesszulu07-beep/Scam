// /api/upload-avatar.js
import cloudinary from "cloudinary";
import multer from "multer";
import fs from "fs";

// Disable default body parsing (Vercel serverless requirement)
export const config = { api: { bodyParser: false } };

// === Hardcoded Cloudinary credentials ===
cloudinary.v2.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
});

// Multer setup for single file upload
const upload = multer({ dest: "/tmp/" }); // Temporary folder for Vercel

// Helper to wrap Multer in a Promise
function multerMiddleware(req, res) {
  return new Promise((resolve, reject) => {
    upload.single("file")(req, res, (err) => {
      if (err) reject(err);
      else resolve(req.file);
    });
  });
}

// Main handler
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Use POST only");

  try {
    // Parse uploaded file
    const file = await multerMiddleware(req, res);
    if (!file) return res.status(400).send("No file uploaded");

    // Get userId from form
    const userId = req.body.userId || req.query.userId;
    if (!userId) return res.status(400).send("Missing userId");

    const publicId = `avatar_${userId}`;

    // Upload with transformation (logic unchanged)
    const result = await cloudinary.v2.uploader.upload(file.path, {
      folder: "avatars",
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ]
    });

    // Delete temp file
    fs.unlinkSync(file.path);

    // Return secure URL
    res.status(200).send(result.secure_url);

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error: " + err.message);
  }
      }
