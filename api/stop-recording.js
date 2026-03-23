import fetch from "node-fetch";

export default async function stopRecording(req, res) {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }

    const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";

    // ✅ 1. STOP RECORDING
    const stopRes = await fetch(
      `https://api.videosdk.live/v2/recordings/end?roomId=${roomId}`,
      {
        method: "POST",
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    const stopText = await stopRes.text();
    console.log("🛑 STOP RAW:", stopText);

    let stopData;
    try {
      stopData = JSON.parse(stopText);
    } catch {
      return res.status(500).json({
        error: "Invalid JSON from stop API",
        raw: stopText
      });
    }

    const recordingId = stopData?.data?.id;

    if (!recordingId) {
      return res.status(500).json({
        error: "No recording ID returned",
        raw: stopData
      });
    }

    // ✅ 2. WAIT UNTIL READY (STRONGER VERSION)
    let recordingUrl = null;

    for (let i = 0; i < 30; i++) { // ~90 seconds max
      console.log(`⏳ Checking recording... attempt ${i}`);

      await new Promise(r => setTimeout(r, 3000));

      const checkRes = await fetch(
        `https://api.videosdk.live/v2/recordings/${recordingId}`,
        {
          headers: { Authorization: API_KEY }
        }
      );

      const checkText = await checkRes.text();
      console.log("📡 CHECK RAW:", checkText);

      let checkData;
      try {
        checkData = JSON.parse(checkText);
      } catch {
        continue; // skip bad responses
      }

      const status = checkData?.data?.status;

      // 🔥 IMPORTANT: handle all states
      if (status === "completed") {
        recordingUrl = checkData?.data?.file?.fileUrl;
        break;
      }

      if (status === "failed") {
        return res.status(500).json({
          error: "Recording processing failed",
          details: checkData
        });
      }
    }

    if (!recordingUrl) {
      return res.status(500).json({
        error: "Recording not ready after waiting (try longer stream)"
      });
    }

    // ✅ 3. RETURN FINAL VIDEO URL
    return res.status(200).json({ recordingUrl });

  } catch (err) {
    console.error("❌ Stop recording error:", err);
    return res.status(500).json({ error: err.message });
  }
  }
