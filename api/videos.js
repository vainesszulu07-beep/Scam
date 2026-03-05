import { v2 as cloudinary } from "cloudinary";

export default async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Use GET only" });
  }

  try {

    /* CONFIGURE CLOUDINARY */

    cloudinary.config({
      cloud_name: "dae7hfmv6",
      api_key: "537929288114165",
      api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM"
    });

    const timestamp = Math.floor(Date.now() / 1000);

    /* PARAMETERS FOR SIGNATURE */

    const params = {
      folder: "videos",
      timestamp
    };

    /* GENERATE SIGNATURE */

    const signature = cloudinary.utils.api_sign_request(
      params,
      cloudinary.config().api_secret
    );

    res.status(200).json({
      signature,
      timestamp,
      apiKey: cloudinary.config().api_key,
      cloudName: cloudinary.config().cloud_name
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

}

/* REQUIRED FOR VERCEL */

export const config = {
  api: { bodyParser: false }
};
