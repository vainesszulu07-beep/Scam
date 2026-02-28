// /api/upload.js
import cloudinary from "cloudinary";
import multer from "multer";
import fs from "fs";

// Disable default body parsing (Vercel serverless requirement)
export const config = { api: { bodyParser: false } };

// === Cloudinary credentials ===
cloudinary.v2.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
});

// Multer setup
const upload = multer({ dest: "/tmp/" });

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
    const file = await multerMiddleware(req, res);
    if (!file) return res.status(400).send("No file uploaded");

    const { userId, type } = req.body || req.query;
    if (!userId) return res.status(400).send("Missing userId");
    if (!type || !["avatar", "post"].includes(type))
      return res.status(400).send("Missing or invalid type");

    let folder, publicId, overwrite, transformation;

    if (type === "avatar") {
      folder = "avatars";
      publicId = `avatar_${userId}`;
      overwrite = true;
      transformation = [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ];
    } else if (type === "post") {
      folder = "posts";
      // Generate unique public ID for posts: userId + timestamp
      publicId = `post_${userId}_${Date.now()}`;
      overwrite = false; // never overwrite posts
      transformation = [
        { width: 800, height: 800, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ];
    }

    // Upload to Cloudinary
    const result = await cloudinary.v2.uploader.upload(file.path, {
      folder,
      public_id: publicId,
      overwrite,
      invalidate: true,
      transformation
    });

    // Delete temp file
    fs.unlinkSync(file.path);

    // Return the **secure URL** for frontend to save in Supabase
    res.status(200).json({ url: result.secure_url, publicId });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error: " + err.message);
  }
         }
