
import crypto from "node:crypto";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const requestId = crypto.randomUUID();

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      stage: "method_check",
      message: "Method not allowed",
      request_id: requestId
    });
  }

  try {
    // STEP 1: Read environment variables
    const env = {
      AD_NETWORK_VERIFY_URL: process.env.AD_NETWORK_VERIFY_URL,
      PARTNER_SUBID: process.env.PARTNER_SUBID,
      PARTNER_APP_ID: process.env.PARTNER_APP_ID,
      PARTNER_SECRET_KEY: process.env.PARTNER_SECRET_KEY
    };

    const missing = Object.entries(env)
      .filter(([name, value]) =>
        typeof value !== "string" || !value.trim()
      )
      .map(([name]) => name);

    if (missing.length > 0) {
      return res.status(500).json({
        success: false,
        stage: "sender_environment_check",
        message: "Environment variables are missing",
        missing,
        request_id: requestId
      });
    }

    // STEP 2: Validate destination URL
    let target;

    try {
      target = new URL(env.AD_NETWORK_VERIFY_URL);

      if (!["https:", "http:"].includes(target.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return res.status(500).json({
        success: false,
        stage: "url_validation",
        message: "AD_NETWORK_VERIFY_URL is invalid",
        request_id: requestId
      });
    }

    // STEP 3: Prepare credentials
    const payload = {
      subid: env.PARTNER_SUBID.trim(),
      id: env.PARTNER_APP_ID.trim(),
      secret_key: env.PARTNER_SECRET_KEY.trim()
    };

    console.log("SENDER DIAGNOSTICS:", {
      request_id: requestId,
      environment: {
        url: true,
        subid: true,
        id: true,
        secret_key: true
      },
      destination: target.origin + target.pathname
    });

    // STEP 4: Send to receiving backend
    let response;

    try {
      response = await fetch(target.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": requestId
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      console.error("SENDER NETWORK ERROR:", {
        request_id: requestId,
        error: error.message
      });

      return res.status(502).json({
        success: false,
        stage: "network_request",
        message: "Could not reach partner backend",
        error: error.message,
        request_id: requestId
      });
    }

    // STEP 5: Read receiving backend response
    const responseText = await response.text();

    let result;

    try {
      result = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        success: false,
        stage: "response_parsing",
        message: "Partner backend did not return valid JSON",
        upstream_status: response.status,
        content_type: response.headers.get("content-type"),
        request_id: requestId
      });
    }

    console.log("PARTNER RESPONSE:", {
      request_id: requestId,
      status: response.status,
      success: result?.success,
      authorized: result?.authorized,
      diagnostics: result?.diagnostics
    });

    return res.status(response.status).json({
      ...result,
      sender_diagnostics: {
        request_id: requestId,
        environment_configured: true,
        request_sent: true,
        response_received: true,
        upstream_status: response.status
      }
    });

  } catch (error) {
    console.error("SENDER INTERNAL ERROR:", {
      request_id: requestId,
      error: error.message
    });

    return res.status(500).json({
      success: false,
      stage: "sender_internal_error",
      message: "Sender backend encountered an error",
      request_id: requestId
    });
  }
}
