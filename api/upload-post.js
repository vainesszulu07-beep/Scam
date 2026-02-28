import cloudinary from "cloudinary";
import multer from "multer";
import fs from "fs";

export const config = { api: { bodyParser: false } };

cloudinary.v2.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
});

const upload = multer({ dest: "/tmp/" });

function multerMiddleware(req, res) {
  return new Promise((resolve, reject) => {
    upload.single("file")(req, res, (err) => {
      if (err) reject(err);
      else resolve(req.file);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Use POST only");

  try {
    const file = await multerMiddleware(req, res);
    if (!file) return res.status(400).send("No file uploaded");

    const userId = req.body.userId || req.query.userId;
    if (!userId) return res.status(400).send("Missing userId");

    // Unique public ID for each post
    const publicId = `post_${userId}_${Date.now()}`;

    const result = await cloudinary.v2.uploader.upload(file.path, {
      folder: "posts",
      public_id: publicId,
      overwrite: false,
      invalidate: true,
      transformation: [
        { width: 800, height: 800, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" }
      ]
    });

    fs.unlinkSync(file.path);
    res.status(200).json({ url: result.secure_url, publicId });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error: " + err.message);
  }
}
