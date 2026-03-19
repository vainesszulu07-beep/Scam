import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://eimecuiixwgmpfpedxpr.supabase.co',
  'sb_secret_SS1rgcdDo4BPB7vX6t5xTw_ceajtnsF'
);

const DAILY_API_KEY = 'f7ec0349a611160fb2d652cfa56d5453f2dc48ac92830c340ee9e64640c04f97';

export default async function handler(req, res) {
  try {
    const { userId } = req.body;
    if(!userId) return res.status(400).json({ success:false, error:'Missing userId' });

    // Get user's room URL
    const { data: profile, error: profileErr } = await supabase
      .from('profile')
      .select('daily_room_url')
      .eq('id', userId)
      .single();
    
    if(profileErr) throw profileErr;
    const roomUrl = profile?.daily_room_url;
    if(!roomUrl) return res.status(400).json({ success:false, error:'No room to delete' });

    // Extract room name from URL
    const roomName = roomUrl.split('/').pop();

    // Delete room via Daily API
    const response = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${DAILY_API_KEY}`,
      }
    });

    if(!response.ok){
      const errText = await response.text();
      return res.status(500).json({ success:false, error: errText });
    }

    // Update Supabase
    const { error } = await supabase
      .from('profile')
      .update({ daily_room_url:null, is_live:false, stream_ended_at:new Date() })
      .eq('id', userId);

    if(error) throw error;

    res.status(200).json({ success:true, message:'Stream ended and room deleted' });

  } catch(err){
    console.error(err);
    res.status(500).json({ success:false, error: err.message });
  }
        }
