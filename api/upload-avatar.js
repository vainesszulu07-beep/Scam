import { parse } from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false, // we handle multipart manually
  },
};

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).end("Method Not Allowed");
    return;
  }

  try {
    // Parse multipart form
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new parse.IncomingForm();
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    const userId = fields.userId;
    const oldPublicId = fields.public_id || null;

    if (!file) return res.status(400).end("No file uploaded");
    if (!userId) return res.status(400).end("Missing userId");

    // Delete old avatar if provided
    if (oldPublicId) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureStr = `public_ids[]=${oldPublicId}&timestamp=${timestamp}${API_SECRET}`;
      const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

      await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/upload`, {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${Buffer.from(`${API_KEY}:${API_SECRET}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public_ids: [oldPublicId],
          timestamp,
          signature,
          api_key: API_KEY,
        }),
      });
    }

    // Prepare file for upload
    const fileData = fs.readFileSync(file.filepath);
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureStr = `timestamp=${timestamp}${API_SECRET}`;
    const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

    const formData = new FormData();
    formData.append("file", new Blob([fileData]), file.originalFilename);
    formData.append("timestamp", timestamp);
    formData.append("api_key", API_KEY);
    formData.append("signature", signature);
    formData.append("folder", "avatars"); // optional

    const uploadResp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
      method: "POST",
      body: formData,
    });

    const uploadData = await uploadResp.json();

    if (!uploadData.secure_url) {
      res.status(500).end("Upload failed: " + JSON.stringify(uploadData));
      return;
    }

    // Return the uploaded file URL as plain text
    res.status(200).end(uploadData.secure_url);

  } catch (err) {
    console.error(err);
    res.status(500).end("Server Error: " + err.message);
  }
                      }
