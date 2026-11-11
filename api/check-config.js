
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  const variables = [
    "AD_NETWORK_VERIFY_URL",
    "PARTNER_SUBID",
    "PARTNER_APP_ID",
    "PARTNER_SECRET_KEY"
  ];

  const results = variables.map(name => ({
    name,
    configured:
      typeof process.env[name] === "string" &&
      process.env[name].trim().length > 0
  }));

  const missing = results.filter(item => !item.configured);

  return res.status(200).json({
    success: missing.length === 0,
    configured: results.length - missing.length,
    total: results.length,
    missing: missing.map(item => item.name),
    variables: results
  });
}
