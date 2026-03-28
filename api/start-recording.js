import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// ⚠️ Hardcoded Supabase credentials (server-side only)
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co", // Your Supabase URL
  "sb_secret_HRrrL83uTSSDXlbksd-7Vw_yzpPS0Y9"      // Your Supabase Service Role Key
);

export default async function startRecording(req, res) {
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

    // 🎬 Call VideoSDK start recording API
    const response = await fetch(
      "https://api.videosdk.live/v2/recordings/start",
      {
        method: "POST",
        headers: {
          Authorization: hostToken, // ✅ hostToken is already a valid JWT
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roomId,
          webhookUrl: "https://scam-gamma.vercel.app/api/webhook", // optional
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
      }
    );

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
