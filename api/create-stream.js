import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg"
);

export default async function handler(req, res) {

  const event = req.body;

  try {

    // 🔴 STREAM STARTED
    if (event.type === "video.live_stream.active") {
      await supabase
        .from("profile")
        .update({ is_live: true })
        .eq("mux_live_stream_id", event.data.id);
    }

    // ⚫ STREAM ENDED
    if (event.type === "video.live_stream.idle") {
      await supabase
        .from("profile")
        .update({ is_live: false })
        .eq("mux_live_stream_id", event.data.id);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}
