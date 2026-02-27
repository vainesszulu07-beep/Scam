// /api/upload-avatar.js
import cloudinary from "cloudinary";
import formidable from "formidable";
import fs from "fs";

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: {
    bodyParser: false, // Disable default body parsing for file upload
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error parsing the files" });
    }

    const userId = fields.userId;
    const file = files.file;

    if (!file || !userId) {
      return res.status(400).json({ error: "File or userId missing" });
    }

    try {
      // Upload to Cloudinary with public_id = userId, overwrite previous avatar
      const result = await cloudinary.v2.uploader.upload(file.filepath, {
        folder: "avatars",
        public_id: userId,
        overwrite: true,
        resource_type: "image",
      });

      // Delete the local temporary file
      fs.unlinkSync(file.filepath);

      return res.status(200).json({ url: result.secure_url });
    } catch (uploadErr) {
      console.error(uploadErr);
      return res.status(500).json({ error: "Failed to upload to Cloudinary" });
    }
  });
}
