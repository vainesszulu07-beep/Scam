import cloudinary from "cloudinary";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET only" });

  try {
    cloudinary.v2.config({
      cloud_name: "dae7hfmv6",
      api_key: "537929288114165",
      api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
    });

    const timestamp = Math.floor(Date.now() / 1000);

    const params = {
      folder: "videos",
      resource_type: "video",  // important for video uploads
      timestamp
    };

    const signature = cloudinary.v2.utils.api_sign_request(params, cloudinary.v2.config().api_secret);

    res.status(200).json({
      signature,
      timestamp,
      apiKey: cloudinary.v2.config().api_key,
      cloudName: cloudinary.v2.config().cloud_name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export const config = { api: { bodyParser: false } };
