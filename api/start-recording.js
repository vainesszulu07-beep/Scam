import fetch from "node-fetch";

export default async function startRecording(req, res) {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }

    // 🔐 Hardcoded API Key
    const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";

    // 🎬 Start recording
    const response = await fetch(
      `https://api.videosdk.live/v2/recordings/start?roomId=${roomId}`,
      {
        method: "POST",
        headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          quality: "h1080p",
          outputMode: "individual" // or "composite"
        })
      }
    );

    const text = await response.text();

    // 🔍 Debug raw response (IMPORTANT)
    console.log("START RAW RESPONSE:", text);

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
        error: "VideoSDK start failed",
        details: data
      });
    }

    // ✅ Return full response (contains recordingId etc.)
    res.status(200).json(data);

  } catch (err) {
    console.error("Recording start error:", err);
    res.status(500).json({ error: err.message });
  }
}
