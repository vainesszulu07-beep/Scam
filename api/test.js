
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

  const publicId = "videos/he6qq8n4oqqnhtqaagex";

  // Build the correct Cloudinary Admin API URL.
  const cloudinaryUrl = new URL(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/video/upload/${publicId
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`
  );

  // Request video metadata, including duration.
  cloudinaryUrl.searchParams.set("media_metadata", "true");

  const authorization = Buffer
    .from(`${apiKey}:${apiSecret}`)
    .toString("base64");

  try {
    const response = await fetch(cloudinaryUrl.toString(), {
      method: "GET",
      headers: {
        Authorization: `Basic ${authorization}`,
        Accept: "application/json"
      }
    });

    const rawBody = await response.text();

    let parsedBody = null;

    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      // Cloudinary did not return valid JSON.
    }

    const duration = parsedBody?.duration ?? null;

    return res.status(200).json({
      cloudinary_http_status: response.status,
      cloudinary_status_text: response.statusText,

      cloudinary_response_raw: rawBody,
      cloudinary_response_json: parsedBody,

      duration_seconds: duration,

      duration_found:
        typeof duration === "number" && duration > 0,

      request_url: cloudinaryUrl.toString()
    });

  } catch (error) {
    return res.status(502).json({
      error: "Could not connect to Cloudinary",
      message: error.message,
      error_name: error.name
    });
  }
}
