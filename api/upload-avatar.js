// api/upload-avatar.js
import { parse } from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

export const config = {
  api: {
    bodyParser: false, // we use formidable to parse multipart/form-data
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse the incoming form
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new parse.IncomingForm();
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const userId = fields.userId;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const oldPublicId = fields.public_id || null;

    // Delete old avatar if public_id provided
    if (oldPublicId) {
      await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image/upload`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              "Basic " +
              Buffer.from(
                `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
              ).toString("base64"),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ public_ids: [oldPublicId] }),
        }
      );
    }

    // Read file data
    const fileData = fs.readFileSync(file.filepath);

    // Upload new avatar to Cloudinary
    const formData = new FormData();
    formData.append("file", fileData, file.originalFilename);
    formData.append("upload_preset", "ml_default"); // your unsigned preset
    formData.append("folder", "avatars");

    const cloudinaryResp = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/upload`,
      { method: "POST", body: formData }
    );

    const json = await cloudinaryResp.json();

    if (!json.secure_url) {
      return res.status(500).json({ error: "Cloudinary upload failed" });
    }

    // Return URL and public_id
    return res.status(200).json({
      url: json.secure_url,
      public_id: json.public_id,
    });
  } catch (err) {
    console.error("Upload avatar error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
