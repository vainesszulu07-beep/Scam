import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Hardcoded Supabase + Daily API
const supabase = createClient(
  'https://eimecuiixwgmpfpedxpr.supabase.co',
  'sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF'
);
const DAILY_API_KEY = 'f7ec0349a611160fb2d652cfa56d5453f2dc48ac92830c340ee9e64640c04f97';

export default async function handler(req, res) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // 1️⃣ Check if user already has a room
    const { data: profile, error: profileErr } = await supabase
      .from('profile')
      .select('daily_room_url')
      .eq('id', userId)
      .single();
    if (profileErr) throw profileErr;

    let roomUrl = profile?.daily_room_url;

    // 2️⃣ If no room yet, create a new Daily room
    if (!roomUrl) {
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DAILY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `user-${userId}`, // persistent room name
          privacy: 'public',
          properties: {
            enable_screenshare: true,
            start_video_off: false,
            start_audio_off: false,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        return res.status(500).json({ error: errData });
      }

      const room = await response.json();
      roomUrl = room.url;

      // Save the new room URL to the profile
      const { error } = await supabase
        .from('profile')
        .update({ daily_room_url: roomUrl })
        .eq('id', userId);
      if (error) throw error;
    }

    // 3️⃣ Update stream status
    await supabase
      .from('profile')
      .update({ is_live: true, stream_started_at: new Date() })
      .eq('id', userId);

    res.status(200).json({ success: true, roomUrl });
  } catch (err) {
    console.error('Error creating Daily stream:', err);
    res.status(500).json({ success: false, error: err.message });
  }
        }
