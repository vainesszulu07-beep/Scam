import fetch from "node-fetch";

export default async function stopRecording(req, res) {
  try {
    const { roomId, hostToken } = req.body;

    // ✅ Validate input
    if (!roomId || !hostToken) {
      return res.status(400).json({ error: "roomId and hostToken are required" });
    }

    // ✅ STOP RECORDING
    const stopRes = await fetch("https://api.videosdk.live/v2/recordings/end", {
      method: "POST",
      headers: {
        Authorization: hostToken, // ✅ Use hostToken from Render
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ roomId }) // roomId in body
    });

    const stopData = await stopRes.json();
    console.log("🛑 STOP RAW:", stopData);

    if (!stopRes.ok) {
      return res.status(stopRes.status).json({
        error: "Failed to stop recording",
        details: stopData
      });
    }

    // ⚠️ Do NOT poll here — use webhook instead
    return res.status(200).json({
      success: true,
      message: "Recording stopped. The final video URL will arrive via webhook."
    });

  } catch (err) {
    console.error("❌ Stop recording error:", err);
    return res.status(500).json({ error: err.message });
  }
        }
