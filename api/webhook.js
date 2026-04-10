import { createClient } from "@supabase/supabase-js";

// ⚠️ Hardcoded Supabase credentials
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg"
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { webhookType, data } = req.body;

  if (webhookType === "recording-stopped") {
    const { meetingId, fileUrl } = data;

    // Get user id from profile using meetingId
    const { data: profile, error: profileError } = await supabase
      .from("profile")
      .select("id")
      .eq("videosdk_room_id", meetingId)
      .single();

    if (profileError || !profile) {
      console.error("User lookup failed:", profileError);
      return res.status(404).json({ error: "User not found" });
    }

    const userId = profile.id;

    // Insert post
    const { error } = await supabase.from("posts").insert({
      user_id: userId,
      video_url: fileUrl
    });

    if (error) {
      console.error("Insert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(200).json({ received: true });
                                }
