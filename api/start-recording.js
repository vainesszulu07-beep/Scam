import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// ⚠️ Server-side only keys
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_secret_HRrrL83uTSSDXlbksd-7Vw_yzpPS0Y9"
);

export default async function startRecording(req, res) {
  const messages = []; // Will hold messages for frontend

  try {
    const { userId } = req.body;
    if (!userId) {
      messages.push("❌ userId is required");
      return res.status(400).json({ success: false, messages });
    }

    messages.push("Step 1️⃣: Fetching user stream info from Supabase...");

    // Fetch user's current stream info
    const { data: profile, error } = await supabase
      .from("profile")
      .select("videosdk_room_id, videosdk_host_token")
      .eq("id", userId)
      .single();

    if (error) {
      messages.push("❌ Failed to fetch profile: " + error.message);
      throw error;
    }

    if (!profile || !profile.videosdk_room_id || !profile.videosdk_host_token) {
      messages.push("❌ User has no active room/token");
      return res.status(400).json({ success: false, messages });
    }

    const { videosdk_room_id: roomId, videosdk_host_token: hostToken } = profile;
    messages.push(`✅ Room ID found: ${roomId}`);
    messages.push("✅ Host Token exists (hidden for security)");

    // Step 2: Start recording via VideoSDK
    messages.push("Step 2️⃣: Calling VideoSDK start-recording API...");

    const response = await fetch("https://api.videosdk.live/v2/recordings/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hostToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        roomId,
        webhookUrl: "https://scam-gamma.vercel.app/api/webhook",
        config: {
          quality: "h1080p",
          outputMode: "composite",
          layout: { type: "GRID", priority: "SPEAKER", gridSize: 4 }
        }
      })
    });

    const text = await response.text();
    messages.push("🎬 VideoSDK raw response received");

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      messages.push("❌ Invalid JSON from VideoSDK");
      return res.status(500).json({ success: false, messages, raw: text });
    }

    if (!response.ok || !data?.data?.id) {
      messages.push("❌ Start recording failed");
      return res.status(500).json({ success: false, messages, details: data });
    }

    messages.push("✅ Recording started successfully!");

    // Step 3: Update Supabase live flags (no recording_id)
    messages.push("Step 3️⃣: Updating live stream info in Supabase...");

    const { error: updateError } = await supabase
      .from("profile")
      .update({ is_live: true, stream_started_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateError) {
      messages.push("❌ Failed to update Supabase: " + updateError.message);
      throw updateError;
    }

    messages.push("✅ Stream info updated successfully!");

    // ✅ Return all messages to frontend
    return res.status(200).json({ success: true, messages });

  } catch (err) {
    console.error("❌ Start recording error:", err);
    messages.push("❌ Error: " + err.message);
    return res.status(500).json({ success: false, messages });
  }
}
