import { createClient } from '@supabase/supabase-js';

// ⚠️ NOT RECOMMENDED: hardcoded credentials (for learning only)
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg"
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { webhookType, data } = req.body;

  if (webhookType === "recording-stopped") {
    const { meetingId, fileUrl } = data;

    const { error } = await supabase
      .from('profile')
      .update({ media_url: fileUrl })
      .eq('videosdk_room_id', meetingId);

    if (error) {
      console.error('Supabase Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`Saved recording for Room ${meetingId}`);
  }

  return res.status(200).json({ received: true });
}
