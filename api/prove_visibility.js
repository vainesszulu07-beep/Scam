export default async function handler(req, res) {

  res.setHeader("Cache-Control", "no-store");

  let stage = "request_received";

  function reportProblem(
    status,
    code,
    message,
    details = {}
  ) {
    const response = {
      success: false,
      stage,
      problem_code: code,
      problems: [message],
      diagnostics: details
    };

    console.error("PROVE VISIBILITY FAILURE:", response);

    return res.status(status).json(response);
  }

  try {

    // ----------------------------------
    // STEP 1: Check HTTP method
    // ----------------------------------

    stage = "method_validation";

    if (req.method !== "POST") {
      return reportProblem(
        405,
        "invalid_method",
        "Only POST requests are accepted.",
        {
          received_method: req.method
        }
      );
    }

    // ----------------------------------
    // STEP 2: Parse request body
    // ----------------------------------

    stage = "body_parsing";

    let body = req.body;

    try {

      if (Buffer.isBuffer(body)) {
        body = JSON.parse(body.toString("utf8"));
      } else if (typeof body === "string") {
        body = JSON.parse(body);
      }

    } catch (error) {

      return reportProblem(
        400,
        "invalid_json",
        "The request body contains invalid JSON.",
        {
          parsing_error: error.message
        }
      );

    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return reportProblem(
        400,
        "invalid_body",
        "The request body must be a JSON object."
      );
    }

    // ----------------------------------
    // STEP 3: Read submitted values
    // ----------------------------------

    stage = "input_validation";

    const impression_id =
      typeof body.impression_id === "string"
        ? body.impression_id.trim()
        : "";

    const visibility_state =
      typeof body.visibility_state === "string"
        ? body.visibility_state.trim().toLowerCase()
        : "";

    const visible_ratio = body.visible_ratio;

    // ----------------------------------
    // STEP 4: Validate impression ID
    // ----------------------------------

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!impression_id) {
      return reportProblem(
        400,
        "missing_impression_id",
        "impression_id was not provided."
      );
    }

    if (!uuidPattern.test(impression_id)) {
      return reportProblem(
        400,
        "invalid_impression_id",
        "impression_id is not a valid UUID.",
        {
          received_impression_id: impression_id
        }
      );
    }

    // ----------------------------------
    // STEP 5: Validate visibility state
    // ----------------------------------

    if (!visibility_state) {
      return reportProblem(
        400,
        "missing_visibility_state",
        "visibility_state was not provided."
      );
    }

    if (
      !["visible", "hidden"].includes(visibility_state)
    ) {
      return reportProblem(
        400,
        "invalid_visibility_state",
        "visibility_state must be visible or hidden.",
        {
          received_visibility_state: visibility_state
        }
      );
    }

    // ----------------------------------
    // STEP 6: Validate visibility ratio
    // ----------------------------------

    if (visible_ratio === undefined || visible_ratio === null) {
      return reportProblem(
        400,
        "missing_visible_ratio",
        "visible_ratio was not provided."
      );
    }

    if (
      typeof visible_ratio !== "number" ||
      !Number.isFinite(visible_ratio)
    ) {
      return reportProblem(
        400,
        "invalid_visible_ratio_type",
        "visible_ratio must be a finite number.",
        {
          received_visible_ratio: visible_ratio,
          received_type: typeof visible_ratio
        }
      );
    }

    if (visible_ratio < 0 || visible_ratio > 1) {
      return reportProblem(
        400,
        "visible_ratio_out_of_range",
        "visible_ratio must be between 0 and 1.",
        {
          received_visible_ratio: visible_ratio
        }
      );
    }

    // ----------------------------------
    // STEP 7: Check Supabase configuration
    // ----------------------------------

    stage = "supabase_configuration";

    const supabaseUrl =
      process.env.SUPABASE_URL?.trim();

    const supabaseKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return reportProblem(
        500,
        "missing_supabase_url",
        "SUPABASE_URL is missing."
      );
    }

    if (!supabaseKey) {
      return reportProblem(
        500,
        "missing_supabase_key",
        "SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is missing."
      );
    }

    try {
      new URL(supabaseUrl);
    } catch {
      return reportProblem(
        500,
        "invalid_supabase_url",
        "SUPABASE_URL is not a valid URL."
      );
    }

    // ----------------------------------
    // STEP 8: Prepare RPC request
    // ----------------------------------

    stage = "supabase_rpc_request";

    const rpcUrl =
      `${supabaseUrl.replace(/\/+$/, "")}` +
      "/rest/v1/rpc/mark_ad_request_if_visible";

    const rpcPayload = {
      p_impression_id: impression_id,
      p_visibility_state: visibility_state,
      p_visible_ratio: visible_ratio
    };

    console.log("VISIBILITY RPC REQUEST:", {
      stage,
      url: rpcUrl,
      payload: rpcPayload
    });

    // ----------------------------------
    // STEP 9: Call Supabase
    // ----------------------------------

    stage = "supabase_rpc_execution";

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    let rpcResponse;
    let rawResponse;

    try {

      rpcResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        },
        body: JSON.stringify(rpcPayload),
        signal: controller.signal
      });

      rawResponse = await rpcResponse.text();

    } catch (error) {

      if (error.name === "AbortError") {
        return reportProblem(
          504,
          "supabase_timeout",
          "Supabase did not respond within 15 seconds."
        );
      }

      return reportProblem(
        502,
        "supabase_connection_failed",
        "The backend could not connect to Supabase.",
        {
          error_name: error.name,
          error_message: error.message
        }
      );

    } finally {
      clearTimeout(timeout);
    }

    // ----------------------------------
    // STEP 10: Parse Supabase response
    // ----------------------------------

    stage = "supabase_response_parsing";

    let result;

    try {
      result = JSON.parse(rawResponse);
    } catch {
      return reportProblem(
        502,
        "invalid_supabase_json",
        "Supabase returned a response that was not valid JSON.",
        {
          supabase_http_status: rpcResponse.status,
          raw_response: rawResponse
        }
      );
    }

    // ----------------------------------
    // STEP 11: Check Supabase HTTP status
    // ----------------------------------

    if (!rpcResponse.ok) {
      return reportProblem(
        502,
        "supabase_http_error",
        "Supabase rejected the RPC request.",
        {
          supabase_http_status: rpcResponse.status,
          supabase_response: result
        }
      );
    }

    // ----------------------------------
    // STEP 12: Validate RPC result
    // ----------------------------------

    stage = "supabase_result_validation";

    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      return reportProblem(
        502,
        "invalid_rpc_result",
        "The SQL function did not return a JSON object.",
        {
          supabase_result: result
        }
      );
    }

    // ----------------------------------
    // STEP 13: Return exact SQL result
    // ----------------------------------

    stage = "completed";

    const finalResponse = {
      ...result,

      backend_diagnostics: {
        stage,
        supabase_http_status: rpcResponse.status,
        request_sent_to_supabase: rpcPayload,
        raw_supabase_response: rawResponse
      }
    };

    console.log(
      "VISIBILITY BACKEND FINAL RESPONSE:",
      finalResponse
    );

    return res.status(200).json(finalResponse);

  } catch (error) {

    return reportProblem(
      500,
      "unexpected_backend_error",
      "An unexpected backend error occurred.",
      {
        error_name: error.name,
        error_message: error.message,
        stack: error.stack
      }
    );

  }

        }
