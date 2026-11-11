
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const response = await fetch(
      process.env.AD_NETWORK_VERIFY_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          subid: process.env.PARTNER_SUBID,
          id: process.env.PARTNER_APP_ID,
          secret_key: process.env.PARTNER_SECRET_KEY
        })
      }
    );

    const result = await response.json();

    return res.status(response.status).json(result);

  } catch (error) {
    console.error("Advertising API error:", error.message);

    return res.status(502).json({
      success: false,
      authorized: false,
      message: "Advertising server unavailable"
    });
  }
}
