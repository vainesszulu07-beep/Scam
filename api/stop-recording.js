import fetch from "node-fetch";

export default async function stopRecording(req, res) {
  try {
    const { roomId } = req.body;

    if (!roomId) return res.status(400).json({ error: "roomId is required" });

    // HARD-CODED VideoSDK API key
    const VIDEOSDK_API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";

    const response = await fetch(
      `https://api.videosdk.live/v2/recordings/stop?roomId=${roomId}`,
      {
        method: "POST",
        headers: {
          Authorization: VIDEOSDK_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // optional: recording configs
          outputMode: "individual" // or "composite"
        })
      }
    );

    const data = await response.json();

    // The recording URL is in data?.recordingUrl
    res.status(200).json({ recordingUrl: data.recordingUrl });
  } catch (err) {
    console.error("Stop recording error:", err);
    res.status(500).json({ error: err.message });
  }
        }
