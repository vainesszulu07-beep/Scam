import fetch from "node-fetch";

export default async function startRecording(req, res) {
  const { roomId } = req.body;

  // Hardcoded VideoSDK API key
  const apiKey = "7b3acbbb-8976-4b84-978a-4533b7b41440"; // <-- replace with your actual key

  try {
    const response = await fetch(
      `https://api.videosdk.live/v2/recordings/start?roomId=${roomId}`,
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          quality: "h1080p",
          outputMode: "individual" // or "composite"
        })
      }
    );

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error("Recording start error:", err);
    res.status(500).json({ error: err.message });
  }
}
