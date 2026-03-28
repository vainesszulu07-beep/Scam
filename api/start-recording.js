import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_secret_HRrrL83uTSSDXlbksd-7Vw_yzpPS0Y9"
);

export default async function startRecording(req, res) {
  const messages = [];

  console.log("🚀 Function started");

  try {
    messages.push("🚀 Function started");

    console.log("📦 Body:", req.body);
    messages.push("📦 Reading request body...");

    const { userId } = req.body;

    if (!userId) {
      messages.push("❌ No userId provided");
      return res.status(400).json({ success: false, messages });
    }

    messages.push("🔍 Fetching user from Supabase...");

    const { data: profile, error } = await supabase
      .from("profile")
      .select("*")
      .eq("id", userId)
      .single();

    console.log("📡 Supabase result:", profile, error);

    if (error || !profile) {
      messages.push("❌ Supabase fetch failed");
      return res.status(500).json({ success: false, messages });
    }

    messages.push("✅ User found in DB");
    messages.push("🎬 Calling VideoSDK...");

    const response = await fetch("https://api.videosdk.live/v2/recordings/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${profile.videosdk_host_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        roomId: profile.videosdk_room_id
      })
    });

    console.log("📡 VideoSDK status:", response.status);

    const text = await response.text();
    console.log("📡 VideoSDK raw:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      messages.push("❌ Invalid JSON from VideoSDK");
      return res.status(500).json({ success: false, messages, raw: text });
    }

    if (!response.ok) {
      messages.push("❌ VideoSDK request failed");
      messages.push(JSON.stringify(data));
      return res.status(500).json({ success: false, messages });
    }

    messages.push("✅ Recording started successfully!");

    return res.status(200).json({
      success: true,
      messages,
      videosdk: data
    });

  } catch (err) {
    console.error("💥 FULL ERROR:", err);
    messages.push("💥 Crash: " + err.message);

    return res.status(500).json({
      success: false,
      messages
    });
  }
}
