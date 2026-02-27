// /api/upload-avatar.js
import formidable from "formidable";
import fetch from "node-fetch";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // we handle the file manually
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    // Parse incoming form
    const form = new formidable.IncomingForm();
    const data = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const { fields, files } = data;
    const file = files.file;
    const userId = fields.userId;

    if (!file) throw new Error("No file uploaded");
    if (!userId) throw new Error("Missing userId");

    // Optional: old avatar public_id for deletion
    const oldPublicId = fields.public_id || null;

    // Delete old avatar if needed
    if (oldPublicId) {
      const deleteResp = await fetch(
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

      // Optional: log deletion response
      const deleteText = await deleteResp.text();
      console.log("Delete old avatar response:", deleteText);
    }

    // Upload new avatar
    const fileData = fs.readFileSync(file.filepath);
    const formData = new FormData();
    formData.append("file", new Blob([fileData]), file.originalFilename);
    formData.append("folder", "avatars");

    const uploadResp = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/upload`,
      {
        method: "POST",
        body: formData,
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
            ).toString("base64"),
        },
      }
    );

    const uploadText = await uploadResp.text();

    if (!uploadResp.ok) {
      res.status(500).send("Upload failed: " + uploadText);
      return;
    }

    const uploadJson = JSON.parse(uploadText);

    // Return just the URL as plain text
    res.status(200).send(uploadJson.secure_url);
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).send("Error: " + err.message);
  }
      }
