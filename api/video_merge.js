// /api/video_merge.js

import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

// --- Supabase setup ---
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg"
);

// --- Cloudinary setup ---
cloudinary.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM",
});

// --- Vercel handler ---
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { session_id, user_id } = req.body;

    if (!session_id || !user_id) {
      return res.status(400).json({ error: "session_id and user_id required" });
    }

    // 1️⃣ Fetch segments
    const { data: segments, error } = await supabase
      .from("video_segments")
      .select("*")
      .eq("session_id", session_id)
      .order("segment_number", { ascending: true });

    if (error) throw error;
    if (!segments || segments.length === 0) {
      return res.status(404).json({ error: "No video segments found" });
    }

    // 2️⃣ Extract public_ids
    const publicIds = segments.map(seg => seg.public_id);

    // ⚠️ IMPORTANT FIX:
    // First video must be base, others are overlays
    const [first, ...rest] = publicIds;

    const transformations = rest.map(pid => ({
      overlay: pid,
      flags: "splice"
    }));

    // 3️⃣ Merge videos
    const merged = await cloudinary.uploader.upload(
      `https://res.cloudinary.com/dae7hfmv6/video/upload/${first}.mp4`,
      {
        resource_type: "video",
        folder: "merged_videos",
        public_id: `session_${session_id}_merged`,
        transformation: transformations,
      }
    );

    // 4️⃣ Save to posts
    const { error: insertError } = await supabase.from("posts").insert([
      {
        user_id,
        video_url: merged.secure_url,
        video_public_id: merged.public_id,
        session_id,
      },
    ]);

    if (insertError) {
      console.warn("Insert error:", insertError);
    }

    // 5️⃣ Return result
    return res.status(200).json({
      merged_url: merged.secure_url,
      merged_public_id: merged.public_id,
    });

  } catch (err) {
    console.error("Merge error:", err);
    return res.status(500).json({ error: err.message });
  }
  }
