// /api/upload-avatar.js
import formidable from "formidable";
import cloudinary from "cloudinary";
import fs from "fs";

export const config = { api: { bodyParser: false } };

// Configure Cloudinary using environment variables
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Use POST method only");
  }

  try {
    // 1️⃣ Create Formidable parser
    const form = formidable({ multiples: false });

    // 2️⃣ Parse incoming form data
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    // 3️⃣ Check file
    const file = files.file;
    if (!file) return res.status(400).send("No file uploaded");

    // 4️⃣ Check userId
    const userId = fields.userId;
    if (!userId) return res.status(400).send("Missing userId field");

    // 5️⃣ Make sure file exists on server
    if (!fs.existsSync(file.filepath)) {
      return res.status(400).send("Uploaded file not found on server");
    }

    // 6️⃣ Upload file to Cloudinary (signed)
    const uploadResult = await cloudinary.v2.uploader.upload(file.filepath, {
      folder: "avatars",
      public_id: `avatar_${userId}_${Date.now()}`,
      overwrite: true
    });

    if (!uploadResult.secure_url) {
      return res.status(500).send("Cloudinary upload failed: unknown error");
    }

    // 7️⃣ Return plain URL directly (no JSON)
    res.status(200).send(uploadResult.secure_url);

  } catch (err) {
    console.error("Avatar upload error:", err);

    // Send readable error message to front-end
    let msg = err.message || "Unknown server error";
    if (err.code) msg += ` (code: ${err.code})`;

    res.status(500).send("Server error: " + msg);
  }
                 }
