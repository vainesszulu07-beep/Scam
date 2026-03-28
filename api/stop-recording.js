import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// ⚠️ Hardcoded Supabase credentials (server-side only)
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co", // Your Supabase URL
  "sb_secret_HRrrL83uTSSDXlbksd-7Vw_yzpPS0Y9"      // Your Supabase Service Role Key
);

export default async function stopRecording(req, res) {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // 🔹 Fetch user's live stream info from Supabase
    const { data: profile, error } = await supabase
      .from("profile")
      .select("videosdk_room_id, videosdk_host_token")
      .eq("id", userId)
      .single();

    if (error) throw error;
    if (!profile || !profile.videosdk_room_id || !profile.videosdk_host_token) {
      return res.status(400).json({ error: "User has no active stream info" });
    }

    const { videosdk_room_id: roomId, videosdk_host_token: hostToken } = profile;

    // 🛑 Call VideoSDK stop recording API
    const stopRes = await fetch(
      "https://api.videosdk.live/v2/recordings/end",
      {
        method: "POST",
        headers: {
          Authorization: hostToken, // ✅ Use hostToken from Supabase
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ roomId }) // roomId in body
      }
    );

    const stopData = await stopRes.json();
    console.log("🛑 STOP RAW:", stopData);

    if (!stopRes.ok) {
      return res.status(stopRes.status).json({
        error: "Failed to stop recording",
        details: stopData
      });
    }

    // ⚠️ Use webhook to get final recording URL
    return res.status(200).json({
      success: true,
      message: "Recording stopped. The final video URL will arrive via webhook."
    });

  } catch (err) {
    console.error("❌ Stop recording error:", err);
    return res.status(500).json({ error: err.message });
  }
      }
