import formidable from "formidable";
import cloudinary from "cloudinary";

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM",
});

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const file = files.file; // file object from browser
    const userId = fields.userId;

    try {
      const result = await cloudinary.v2.uploader.upload(file.filepath, {
        public_id: userId,
        overwrite: true
      });

      return res.status(200).json({ url: result.secure_url });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
             }
