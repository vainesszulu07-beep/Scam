
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return res.status(500).json({
      error: "Missing Cloudinary environment variables",
      cloudNameConfigured: Boolean(cloudName),
      apiKeyConfigured: Boolean(apiKey),
      apiSecretConfigured: Boolean(apiSecret)
    });
  }

  // Exact asset from your message.
  const publicId = "videos/he6qq8n4oqqnhtqaagex";

  const cloudinaryUrl =
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}` +
    `/resources/video/upload/${publicId}`;

  const authorization = Buffer
    .from(`${apiKey}:${apiSecret}`)
    .toString("base64");

  try {
    const response = await fetch(cloudinaryUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: "application/json"
      }
    });

    // Preserve Cloudinary's original response body.
    const rawBody = await response.text();

    let parsedBody;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }

    return res.status(200).json({
      cloudinary_http_status: response.status,
      cloudinary_status_text: response.statusText,
      cloudinary_response_raw: rawBody,
      cloudinary_response_json: parsedBody,
      duration_seconds: parsedBody?.duration ?? null,
      request_url: cloudinaryUrl
    });

  } catch (error) {
    return res.status(502).json({
      error: "Could not connect to Cloudinary",
      message: error.message,
      error_name: error.name
    });
  }
}
