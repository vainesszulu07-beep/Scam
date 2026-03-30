// /api/video_merge.js

import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

// --- Supabase ---
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg"
);

// --- Cloudinary ---
cloudinary.config({
  cloud_name: "dae7hfmv6",
  api_key: "537929288114165",
  api_secret: "zCymgTbN7zHglNl-L9GqzEds4fM",
});

// --- Helper ---
const formatPublicId = (id) => `video:${id.replace(/\//g, ":")}`;

// --- API handler ---
export default async function handler(req, res) {
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
      .select("public_id, segment_number")
      .eq("session_id", session_id)
      .order("segment_number", { ascending: true });

    if (error) throw error;

    if (!segments || segments.length === 0) {
      return res.status(404).json({ error: "No segments found" });
    }

    // 2️⃣ Extract IDs
    const publicIds = segments.map(s => s.public_id);
    const [first, ...rest] = publicIds;

    // 3️⃣ Build transformations (✅ FIXED: NO SQUASH)
    const transformations = rest.map(pid => ({
      overlay: formatPublicId(pid),
      flags: "splice",
      width: 1080,
      height: 1080,
      crop: "fit",        // ✅ keeps aspect ratio
      background: "black" // ✅ fills empty space
    }));

    // 4️⃣ Base URL
    const baseUrl = `https://res.cloudinary.com/dae7hfmv6/video/upload/${first}.mp4`;

    // 5️⃣ Merge (✅ FIXED BASE TOO)
    const merged = await cloudinary.uploader.upload(baseUrl, {
      resource_type: "video",
      public_id: `merged/session_${session_id}`,
      overwrite: true,
      transformation: [
        {
          width: 1080,
          height: 1080,
          crop: "fit",
          background: "black"
        },
        ...transformations
      ],
    });

    // 6️⃣ Save to posts
    const { error: insertError } = await supabase
      .from("posts")
      .insert([
        {
          user_id,
          session_id,
          video_url: merged.secure_url,
          video_public_id: merged.public_id,
        },
      ]);

       if (insertError) throw insertError;

    // 7️⃣ Delete individual segments from Cloudinary
    for (const pid of publicIds) {
      try {
        await cloudinary.uploader.destroy(pid, { resource_type: "video" });
      } catch (err) {
        console.warn("Failed to delete segment from Cloudinary:", pid, err.message);
      }
    }
 

    // 7️⃣ Cleanup segments
    await supabase
      .from("video_segments")
      .delete()
      .eq("session_id", session_id);

    // 8️⃣ Response
    return res.status(200).json({
      success: true,
      merged_url: merged.secure_url,
      merged_public_id: merged.public_id,
    });

  } catch (err) {
    console.error("❌ Merge error:", err);
    return res.status(500).json({
      error: err.message,
    });
  }
}
