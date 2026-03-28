import { createClient } from "@supabase/supabase-js";

// ⚠️ Hardcoded Supabase credentials (server-side only, DO NOT expose publicly)
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co", // Supabase 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg"  // Supabase Service Role Key
);

export default async function startRecording(req, res) {
  const messages = [];

  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, messages: ["❌ userId required"] });

    messages.push("🚀 Fetching user stream info from Supabase...");

    const { data: profile, error } = await supabase
      .from("profile")
      .select("videosdk_room_id, videosdk_host_token")
      .eq("id", userId)
      .single();

    if (error) throw error;
    if (!profile || !profile.videosdk_room_id || !profile.videosdk_host_token) {
      return res.status(400).json({ success: false, messages: [...messages, "❌ No active room/token"] });
    }

    const { videosdk_room_id: roomId, videosdk_host_token: hostToken } = profile;
    messages.push(`✅ Room ID: ${roomId} | Host token found`);

    // Start recording
    messages.push("🎬 Starting recording via VideoSDK API...");

    const response = await fetch("https://api.videosdk.live/v2/recordings/start", {
      method: "POST",
      headers: {
        Authorization: hostToken, // IMPORTANT: No Bearer
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        roomId,
        webhookUrl: "https://your-frontend.com/api/webhook",
        config: {
          quality: "h1080p",
          outputMode: "composite",
          layout: { type: "GRID", priority: "SPEAKER", gridSize: 4 }
        }
      })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (!response.ok || !data?.data?.id) {
      return res.status(500).json({ success: false, messages: [...messages, `❌ Recording start failed`, JSON.stringify(data)] });
    }

    messages.push("✅ Recording started successfully");

    // Update Supabase live flags
    await supabase
      .from("profile")
      .update({ is_live: true, stream_started_at: new Date().toISOString() })
      .eq("id", userId);

    messages.push("✅ Live flags updated in Supabase");

    res.status(200).json({ success: true, messages });

  } catch (err) {
    console.error(err);
    messages.push(`❌ Error: ${err.message}`);
    res.status(500).json({ success: false, messages });
  }
      }
