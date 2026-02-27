// /api/upload-avatar.js
import { parse } from "formidable";
import fs from "fs";
import cloudinary from "cloudinary";

export const config = { api: { bodyParser: false } };

// Configure Cloudinary with environment variables
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed. Use POST.");
  }

  try {
    // 1️⃣ Parse form data
    let fields, files;
    try {
      ({ fields, files } = await new Promise((resolve, reject) => {
        const form = new parse.IncomingForm();
        form.parse(req, (err, fields, files) => {
          if (err) reject(err);
          else resolve({ fields, files });
        });
      }));
    } catch (err) {
      return res.status(400).send("Failed to parse form data: " + err.message);
    }

    // 2️⃣ Check file
    const file = files.file;
    if (!file) {
      return res.status(400).send("No file uploaded. Please select a file.");
    }
    if (!fs.existsSync(file.filepath)) {
      return res.status(400).send("Uploaded file not found on server.");
    }

    // 3️⃣ Get userId
    const userId = fields.userId;
    if (!userId) {
      return res.status(400).send("Missing userId. Cannot associate avatar with user.");
    }

    // 4️⃣ Read file safely
    let fileData;
    try {
      fileData = fs.readFileSync(file.filepath);
    } catch (err) {
      return res.status(500).send("Failed to read uploaded file: " + err.message);
    }

    // 5️⃣ Upload to Cloudinary (signed)
    let uploadResult;
    try {
      uploadResult = await cloudinary.v2.uploader.upload(
        file.filepath,
        {
          folder: "avatars",
          public_id: `avatar_${userId}_${Date.now()}`,
          overwrite: true
        }
      );
    } catch (err) {
      return res.status(500).send("Cloudinary upload failed: " + err.message);
    }

    if (!uploadResult.secure_url) {
      return res.status(500).send("Cloudinary upload failed: No URL returned.");
    }

    // ✅ Success: return plain URL
    res.status(200).send(uploadResult.secure_url);

  } catch (err) {
    // Catch-all for unexpected errors
    res.status(500).send("Server error: " + err.message);
  }
}
