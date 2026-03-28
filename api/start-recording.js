import fetch from "node-fetch";

export default async function startRecording(req, res) {
  try {
    const { roomId, hostToken } = req.body;

    // ✅ Validate input
    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }
    if (!hostToken) {
      return res.status(400).json({ error: "hostToken is required" });
    }

    // 🎬 Call VideoSDK with proper webhook
    const response = await fetch("https://api.videosdk.live/v2/recordings/start", {
      method: "POST",
      headers: {
        Authorization: hostToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        roomId,
        webhookUrl: "https://your-vercel-domain.vercel.app/api/webhook", // ✅ webhook endpoint
        config: {
          quality: "h1080p",
          outputMode: "composite",
          layout: {
            type: "GRID",
            priority: "SPEAKER",
            gridSize: 4
          }
        }
      })
    });

    const text = await response.text();
    console.log("🎬 START RAW:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "Invalid JSON from VideoSDK",
        raw: text
      });
    }

    if (!response.ok) {
      return res.status(500).json({
        error: "Start recording failed",
        details: data
      });
    }

    // ✅ IMPORTANT: return recordingId
    const recordingId = data?.data?.id;

    res.status(200).json({
      success: true,
      recordingId,
      message: "Recording started"
    });

  } catch (err) {
    console.error("❌ Start recording error:", err);
    res.status(500).json({ error: err.message });
  }
      }
