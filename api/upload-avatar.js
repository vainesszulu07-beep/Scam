// /api/upload-avatar.js
import { parse } from "formidable";
import fs from "fs";
import fetch from "node-fetch";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed. Use POST.");
  }

  try {
    // 1️⃣ Parse form safely
    let fields, files;
    try {
      ({ fields, files } = await new Promise((resolve, reject) => {
        const form = new parse.IncomingForm();
        form.parse(req, (err, fields, files) => err ? reject(err) : resolve({ fields, files }));
      }));
    } catch (err) {
      return res.status(400).send("Failed to parse form data: " + err.message);
    }

    // 2️⃣ Check file exists
    const file = files.file;
    if (!file) {
      return res.status(400).send("No file uploaded. Select a file first.");
    }
    if (!fs.existsSync(file.filepath)) {
      return res.status(400).send("Uploaded file not found on server.");
    }

    // 3️⃣ Get userId
    const userId = fields.userId;
    if (!userId) {
      return res.status(400).send("Missing userId field.");
    }

    // 4️⃣ Read file safely
    let fileData;
    try {
      fileData = fs.readFileSync(file.filepath);
    } catch (err) {
      return res.status(500).send("Failed to read uploaded file: " + err.message);
    }

    // 5️⃣ Prepare Cloudinary form
    const formData = new FormData();
    formData.append("file", new Blob([fileData]), file.originalFilename);
    formData.append("upload_preset", "ml_default"); // adjust if using unsigned preset
    formData.append("folder", "avatars");

    // 6️⃣ Upload to Cloudinary
    let cloudResp, cloudJson;
    try {
      cloudResp = await fetch("https://api.cloudinary.com/v1_1/dae7hfmv6/upload", {
        method: "POST",
        body: formData
      });
    } catch (err) {
      return res.status(500).send("Failed to reach Cloudinary: " + err.message);
    }

    try {
      cloudJson = await cloudResp.json();
    } catch (err) {
      return res.status(500).send("Cloudinary returned invalid response: " + err.message);
    }

    if (!cloudJson.secure_url) {
      return res.status(500).send("Cloudinary upload failed: " + (cloudJson.error?.message || "Unknown error"));
    }

    // 7️⃣ Return plain URL
    res.status(200).send(cloudJson.secure_url);

  } catch (err) {
    // Catch-all: this should never crash
    res.status(500).send("Server error: " + err.message);
  }
  }
