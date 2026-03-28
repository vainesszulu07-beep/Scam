// /api/webhook.js
export default async function handler(req, res) {
  try {
    // ✅ Only accept POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // VideoSDK sends JSON
    const event = req.body;
    console.log("📬 Webhook received:", event);

    // Example event structure:
    // {
    //   event: "recording-completed",
    //   data: {
    //     roomId: "xyz",
    //     recordingId: "abc123",
    //     file: { fileUrl: "https://..." },
    //     status: "completed"
    //   }
    // }

    if (event.event === "recording-completed" && event.data?.file?.fileUrl) {
      const { roomId, recordingId, file } = event.data;
      const recordingUrl = file.fileUrl;

      // ✅ Save recording URL
      // In production, save to DB with roomId or userId
      // For demo, we can store in a simple in-memory object
      // WARNING: In-memory storage is temporary, only works while server is running
      global.recordings = global.recordings || {};
      global.recordings[roomId] = {
        recordingId,
        recordingUrl,
        receivedAt: new Date().toISOString()
      };

      console.log(`✅ Recording URL saved for room ${roomId}: ${recordingUrl}`);

      return res.status(200).json({ success: true });
    }

    // If webhook is not for recording-completed, just acknowledge
    return res.status(200).json({ success: true, message: "Webhook received but no recordingUrl" });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
