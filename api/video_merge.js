// backend/video_merge.js
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

const app = express();
app.use(express.json());

// --- Supabase setup (hardcoded) ---
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co", // your Supabase URL
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg"          // your service role key
);

// --- Cloudinary setup (hardcoded) ---
cloudinary.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM",
});

// --- Merge endpoint ---
app.post("/merge-session-videos", async (req, res) => {
  try {
    const { session_id, user_id } = req.body;

    if (!session_id || !user_id)
      return res.status(400).json({ error: "session_id and user_id required" });

    // 1️⃣ Fetch all video segments for this session
    const { data: segments, error } = await supabase
      .from("video_segments")
      .select("*")
      .eq("session_id", session_id)
      .order("segment_number", { ascending: true });

    if (error) throw error;
    if (!segments || segments.length === 0)
      return res.status(404).json({ error: "No video segments found" });

    // 2️⃣ Build an array of public_ids in order
    const publicIds = segments.map(seg => seg.public_id);

    // 3️⃣ Merge using Cloudinary "concat" (overlay with splice)
    const transformation = publicIds.map(pid => ({ overlay: pid, flags: "splice" }));

    const merged = await cloudinary.uploader.upload(
      "https://res.cloudinary.com/demo/video/upload/empty.mp4", // dummy base video
      {
        resource_type: "video",
        folder: "merged_videos",
        public_id: `session_${session_id}_merged`,
        transformation: transformation,
      }
    );

    // 4️⃣ Save merged video info in posts table
    const { error: insertError } = await supabase.from("posts").insert([
      {
        user_id,
        video_url: merged.secure_url,
        video_public_id: merged.public_id,
        session_id,
      },
    ]);

    if (insertError) console.warn("Error saving merged video info:", insertError);

    // 5️⃣ Return merged video URL
    res.json({ merged_url: merged.secure_url, merged_public_id: merged.public_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
