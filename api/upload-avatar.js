// api/upload-avatar.js
import { parse } from "formidable";
import fs from "fs";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false, // we handle parsing manually
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  try {
    // Parse form data
    const data = await new Promise((resolve, reject) => {
      const form = new parse.IncomingForm();
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const { files, fields } = data;
    const file = files.file;

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const userId = fields.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const oldPublicId = fields.public_id || null; // optional old avatar

    // Delete old avatar from Cloudinary if provided
    if (oldPublicId) {
      await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ public_ids: [oldPublicId] }),
        }
      );
    }

    // Upload new avatar
    const fileData = fs.readFileSync(file.filepath);

    // Cloudinary requires a multipart/form-data POST
    const formData = new FormData();
    formData.append("file", new Blob([fileData]), file.originalFilename);
    formData.append("upload_preset", "ml_default"); // your unsigned preset
    formData.append("folder", "avatars");

    const cloudinaryResp = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`,
      { method: "POST", body: formData }
    );

    const json = await cloudinaryResp.json();

    if (!json.secure_url) {
      return res.status(500).json({ error: "Cloudinary upload failed" });
    }

    // Return JSON with new URL and public_id
    return res.status(200).json({
      url: json.secure_url,
      public_id: json.public_id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
