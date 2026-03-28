// /api/webhook.js  (Vercel or Render)

import { createClient } from "@supabase/supabase-js";

// 🔐 Hardcoded Supabase credentials
const supabaseUrl = "https://eimecuiixwgmpfpedxpr.supabase.co";
const supabaseKey = "sb_secret_j8Vq6ENuxX-g22uG-uXskA_iptyi_Nr"; // ⚠️ Use service role key (NOT anon)
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    // ✅ Only allow POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const event = req.body;

    console.log("📡 Webhook received:", JSON.stringify(event, null, 2));

    // ✅ Extract data safely
    const recordingData = event?.data;

    if (!recordingData) {
      return res.status(400).json({ error: "No recording data found" });
    }

    const roomId =
      recordingData.roomId || recordingData.meetingId;

    const fileUrl =
      recordingData?.file?.fileUrl ||
      recordingData?.files?.[0]?.fileUrl;

    // ❌ Validate required fields
    if (!roomId || !fileUrl) {
      console.log("⚠️ Missing roomId or fileUrl");
      return res.status(400).json({
        error: "Missing roomId or fileUrl",
      });
    }

    console.log("🎯 Room ID:", roomId);
    console.log("🎥 File URL:", fileUrl);

    // ✅ Find user by videosdk_room_id
    const { data: user, error: findError } = await supabase
      .from("profile")
      .select("id")
      .eq("videosdk_room_id", roomId)
      .single();

    if (findError || !user) {
      console.error("❌ User not found for room:", roomId);
      return res.status(404).json({
        error: "User not found for this room",
      });
    }

    // ✅ Update recording URL in profile table
    const { error: updateError } = await supabase
      .from("profile")
      .update({
        url: fileUrl,
        is_live: false,
        stream_ended_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("❌ Supabase update error:", updateError);
      return res.status(500).json({
        error: "Failed to update profile",
      });
    }

    console.log(`✅ Recording saved for user ${user.id}`);

    return res.status(200).json({
      success: true,
      message: "Webhook processed successfully",
    });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({
      error: err.message,
    });
  }
  }
