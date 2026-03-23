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

    const stopData = await stopRes.json();
    console.log("STOP RESPONSE:", stopData);

    const recordingId = stopData?.data?.id;

    if (!recordingId) {
      return res.status(500).json({
        error: "No recording ID returned",
        raw: stopData
      });
    }

    // ✅ 2. WAIT UNTIL READY
    let recordingUrl = null;

    for (let i = 0; i < 25; i++) {
      console.log(`Checking recording... attempt ${i}`);

      await new Promise(r => setTimeout(r, 3000)); // wait 3 sec

      const checkRes = await fetch(
        `https://api.videosdk.live/v2/recordings/${recordingId}`,
        {
          headers: {
            Authorization: API_KEY
          }
        }
      );

      const checkData = await checkRes.json();
      console.log("CHECK RESPONSE:", checkData);

      if (checkData?.data?.status === "completed") {
        recordingUrl = checkData?.data?.file?.fileUrl;
        break;
      }
    }

    if (!recordingUrl) {
      return res.status(500).json({
        error: "Recording not ready after waiting"
      });
    }

    // ✅ 3. RETURN ONLY WHEN READY
    res.status(200).json({ recordingUrl });

  } catch (err) {
    console.error("Stop recording error:", err);
    res.status(500).json({ error: err.message });
  }
  }
