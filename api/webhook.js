import { createClient } from "@supabase/supabase-js";

// Hardcoded Supabase (server-side only)
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE"
);

export default async function webhook(req, res) {
  try {
    // Only allow POST from VideoSDK
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const payload = req.body;

    // ⚡ VideoSDK sends roomId and recordingUrl
    const roomId = payload?.roomId;
    const recordingUrl = payload?.recordingUrl;

    if (!roomId || !recordingUrl) {
      return res.status(400).json({ error: "Missing roomId or recordingUrl" });
    }

    // 🔹 Find the user profile by roomId
    const { data: profiles, error } = await supabase
      .from("profile")
      .select("id")
      .eq("videosdk_room_id", roomId);

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ error: "No profile found for this roomId" });
    }

    const userId = profiles[0].id;

    // 🔹 Update the profile with recording URL
    const { error: updateError } = await supabase
      .from("profile")
      .update({
        url: recordingUrl,
        is_live: false,
        stream_ended_at: new Date().toISOString(),
        stream_camera_on: false,
        stream_mic_on: false
      })
      .eq("id", userId);

    if (updateError) throw updateError;

    console.log(`✅ Recording URL updated for user ${userId}: ${recordingUrl}`);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ error: err.message });
  }
                                   }
