// upload-avatar.js
import { parse } from "formidable";
import fs from "fs";
import fetch from "node-fetch";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed. Use POST.");
  }

  try {
    // Parse form safely
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new parse.IncomingForm();
      form.parse(req, (err, fields, files) => {
        if (err) reject(new Error("Failed to parse form data"));
        else resolve({ fields, files });
      });
    });

    const file = files.file;
    if (!file) return res.status(400).send("No file uploaded. Please select an image.");

    const userId = fields.userId;
    if (!userId) return res.status(400).send("Missing user ID. Login required.");

    // Read the file safely
    let fileData;
    try {
      fileData = fs.readFileSync(file.filepath);
    } catch {
      return res.status(500).send("Failed to read uploaded file. Please try again.");
    }

    // Prepare form for Cloudinary
    const formData = new FormData();
    formData.append("file", new Blob([fileData]), file.originalFilename);
    formData.append("upload_preset", "ml_default"); // your preset
    formData.append("folder", "avatars");

    // Upload to Cloudinary safely
    let cloudResp;
    try {
      cloudResp = await fetch(`https://api.cloudinary.com/v1_1/dae7hfmv6/upload`, {
        method: "POST",
        body: formData,
      });
    } catch {
      return res.status(500).send("Failed to connect to Cloud storage. Try again later.");
    }

    let cloudJson;
    try {
      cloudJson = await cloudResp.json();
    } catch {
      return res.status(500).send("Unexpected response from Cloud storage.");
    }

    if (!cloudJson.secure_url) {
      return res.status(500).send(
        cloudJson.error?.message || "Cloud storage rejected the file upload."
      );
    }

    // Return only understandable URL as plain text
    return res.status(200).send(cloudJson.secure_url);

  } catch (err) {
    // Any other unexpected error
    return res.status(500).send("An unexpected error occurred: " + (err.message || "Unknown error"));
  }
      }
