// /api/upload-avatar.js
import { parse } from "formidable";
import fs from "fs";
import cloudinary from "cloudinary";

// Disable body parsing (needed for file uploads)
export const config = { api: { bodyParser: false } };

// Configure Cloudinary using environment variables
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed. Use POST.");
  }

  try {
    // 1️⃣ Parse the incoming form
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new parse.IncomingForm();
      form.parse(req, (err, fields, files) =>
        err ? reject(err) : resolve({ fields, files })
      );
    });

    // 2️⃣ Check file exists
    const file = files.file;
    if (!file) return res.status(400).send("No file uploaded.");
    if (!fs.existsSync(file.filepath)) return res.status(400).send("File not found.");

    // 3️⃣ Get userId
    const userId = fields.userId;
    if (!userId) return res.status(400).send("Missing userId field.");

    // 4️⃣ Upload to Cloudinary (signed)
    let uploadResult;
    try {
      uploadResult = await cloudinary.v2.uploader.upload(file.filepath, {
        folder: "avatars",
        public_id: `avatar_${userId}_${Date.now()}`,
        overwrite: true,
      });
    } catch (err) {
      return res.status(500).send("Cloudinary upload failed: " + err.message);
    }

    if (!uploadResult.secure_url) {
      return res.status(500).send("Cloudinary did not return a secure URL.");
    }

    // 5️⃣ Return URL as plain text
    res.status(200).send(uploadResult.secure_url);
  } catch (err) {
    // Catch-all for unexpected errors
    res.status(500).send("Server error: " + err.message);
  }
        }
