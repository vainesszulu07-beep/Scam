// pages/api/create-stream.js
import Mux from '@mux/mux-node';
import { createClient } from '@supabase/supabase-js';

// ---------- HARD-CODED KEYS ----------
const mux = new Mux({
  tokenId: 'b5d8f579-3812-4961-85a9-a762d4003ecf',
  tokenSecret: '/h1x13wB0f3dfVpaHXRHyOG7FCoGhP7Upp/kpxf4VFapO9VmIyWekaXXssOdJVhuJWqzdZGLVN7',
});

const supabase = createClient(
  'https://eimecuiixwgmpfpedxpr.supabase.co', // Supabase URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg'      // Service Role Key
);

// ---------- API HANDLER ----------
export default async function handler(req, res) {
  const { userId } = req.body; // Pass the logged-in user's ID from frontend

  try {
    // 1️⃣ Create Mux live stream
    const stream = await mux.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] },
    });

    // 2️⃣ Prepare data to update in Supabase
    const updateData = {
      mux_live_stream_id: stream.id,
      mux_stream_key: stream.stream_key,
      mux_playback_id: stream.playback_ids[0].id,
      is_live: false,
    };

    // 3️⃣ Update user's profile table with stream info
    await supabase
      .from('profile')
      .update(updateData)
      .eq('id', userId);

    // 4️⃣ Respond to frontend
    res.status(200).json({ success: true, data: updateData });
  } catch (err) {
    console.error('Error creating stream:', err);
    res.status(500).json({ error: err.message });
  }
}
