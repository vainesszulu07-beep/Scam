// /api/video.js
import cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
});

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  const timestamp = Math.floor(Date.now() / 1000); // current seconds
  const folder = "videos"; // or "images" if you switch to pics

  // Cloudinary signs only the fields you send in the POST request
  const signature = cloudinary.v2.utils.api_sign_request({ folder, timestamp }, cloudinary.v2.config().api_secret);

  res.status(200).json({
    signature,
    timestamp,
    apiKey: cloudinary.v2.config().api_key,
    cloudName: cloudinary.v2.config().cloud_name
  });
}
