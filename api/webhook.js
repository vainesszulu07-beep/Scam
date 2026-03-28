// pages/api/webhook.js  (or /api/webhook.js on Render)
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://eimecuiixwgmpfpedxpr.supabase.co";
const supabaseKey = "sb_secret_rECSmZ44U3QBgEkG-D63JQ_R9I_2xiu"; // Hardcoded Supabase secret
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    // ✅ Only POST requests
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const event = req.body;

    console.log("📡 Received Webhook:", event);

    // Check if this is a recording completed event
    const recordingData = event?.data;
    if (!recordingData) {
      return res.status(400).json({ error: "No data in webhook" });
    }

    // Extract roomId and file URL
    const roomId = recordingData.roomId || recordingData.meetingId;
    const fileUrl = recordingData?.file?.fileUrl;

    if (!roomId || !fileUrl) {
      return res.status(400).json({ error: "Missing roomId or fileUrl" });
    }

    // Map roomId to userId
    // ⚠️ You need a way to store roomId -> userId mapping when creating room
    // For simplicity, assume roomId == userId for now
    const userId = roomId;

    // Update the profile table with recording URL
    const { error } = await supabase
      .from("profile")
      .update({ url: fileUrl })
      .eq("id", userId);

    if (error) {
      console.error("❌ Supabase update error:", error);
      return res.status(500).json({ error: "Failed to update Supabase" });
    }

    console.log(`✅ Updated recording URL for user ${userId}: ${fileUrl}`);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
