import { createClient } from "@supabase/supabase-js";

// Hardcoded Supabase (server-side only)
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_secret_HRrrL83uTSSDXlbksd-7Vw_yzpPS0Y9"
);

export default async function webhook(req, res) {
  try {
    // Only allow POST from VideoSDK
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const payload = req.body;

    // ⚡ VideoSDK sends roomId and recordingUrl
    const roomId = payload?.roomId;
    const recordingUrl = payload?.recordingUrl;

    if (!roomId || !recordingUrl) {
      return res.status(400).json({ success: false, error: "Missing roomId or recordingUrl" });
    }

    // 🔹 Find the user profile by roomId
    const { data: profiles, error } = await supabase
      .from("profile")
      .select("id")
      .eq("videosdk_room_id", roomId);

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return res.status(404).json({ success: false, error: "No profile found for this roomId" });
    }

    const userId = profiles[0].id;

    // 🔹 Update the profile with recording URL first
    const { error: urlError } = await supabase
      .from("profile")
      .update({
        url: recordingUrl,
        is_live: false,
        stream_ended_at: new Date().toISOString(),
        stream_camera_on: false,
        stream_mic_on: false
      })
      .eq("id", userId);

    if (urlError) throw urlError;
    console.log(`✅ Recording URL saved for user ${userId}: ${recordingUrl}`);

    // 🔹 Now clear the room/session info safely
    const { error: clearError } = await supabase
      .from("profile")
      .update({
        videosdk_room_id: null,
        videosdk_host_token: null,
        videosdk_viewer_token: null
      })
      .eq("id", userId);

    if (clearError) throw clearError;
    console.log(`🧹 Cleared room/session info for user ${userId}`);

    // ✅ Always return success
    return res.status(200).json({ success: true, message: "Webhook processed successfully." });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
