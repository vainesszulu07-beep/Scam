import { parse } from "formidable";
import fs from "fs";
import cloudinary from "cloudinary";

export const config = { api: { bodyParser: false } };

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed. Use POST.");

  try {
    // Parse form
    const { fields, files } = await new Promise((resolve, reject) => {
      const form = new parse.IncomingForm();
      form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
    });

    const file = files.file;
    if (!file) return res.status(400).send("No file uploaded");
    const userId = fields.userId;
    if (!userId) return res.status(400).send("Missing userId");

    // Read file
    const fileData = fs.readFileSync(file.filepath);

    // Upload to Cloudinary signed
    const uploadResult = await cloudinary.v2.uploader.upload(
      file.filepath,
      {
        folder: "avatars",
        public_id: `avatar_${userId}_${Date.now()}`,
        overwrite: true
      }
    );

    if (!uploadResult.secure_url) return res.status(500).send("Cloudinary upload failed");

    res.status(200).send(uploadResult.secure_url); // Return plain URL
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error: " + err.message);
  }
  }
