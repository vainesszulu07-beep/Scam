import cloudinary from "cloudinary";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  cloudinary.v2.config({
    cloud_name: "dae7hfmv6",
    api_key: "537929288114165",
    api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
  });

  const timestamp = Math.floor(Date.now() / 1000);

  // IMPORTANT: include resource_type for videos
  const paramsToSign = {
    folder: "videos",
    timestamp,
    resource_type: "video"
  };

  const signature = cloudinary.v2.utils.api_sign_request(
    paramsToSign,
    cloudinary.v2.config().api_secret
  );

  res.status(200).json({
    signature,
    timestamp,
    apiKey: cloudinary.v2.config().api_key,
    cloudName: cloudinary.v2.config().cloud_name,
    resource_type: "video"  // send this so browser uses the correct type
  });
}
