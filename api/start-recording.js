// start-recording.js
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

// --- Supabase client ---
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg" // server-side only
);

// --- VideoSDK API key (crawler role) ---
const VIDEOSDK_API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440"; // server-side only, DO NOT expose to frontend

// --- API handler ---
export default async function handler(req, res) {
  const logs = [];

  try {
    logs.push("🚀 API call started");

    // 1️⃣ Get userId from frontend
    const { userId } = req.body;
    if (!userId) {
      logs.push("❌ No userId provided");
      return res.status(400).json({ success: false, logs });
    }
    logs.push(`✅ userId received: ${userId}`);

    // 2️⃣ Fetch user profile from Supabase
    logs.push("🔍 Fetching user profile from Supabase...");
    const { data: profile, error } = await supabase
      .from("profile")
      .select("videosdk_room_id")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      logs.push("❌ Failed to fetch profile: " + (error?.message || "Profile not found"));
      return res.status(500).json({ success: false, logs });
    }

    const { videosdk_room_id: roomId } = profile;
    if (!roomId) {
      logs.push("❌ Profile missing roomId. Recording cannot start.");
      return res.status(500).json({ success: false, logs });
    }
    logs.push(`📡 Using roomId: ${roomId}`);

    // 3️⃣ Start VideoSDK recording with server API key (crawler role)
    logs.push("🎬 Calling VideoSDK start recording with server key...");
    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VIDEOSDK_API_KEY}`, // Use crawler/API key here
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId,
        config: {
          layout: { type: "GRID", priority: "SPEAKER", gridSize: 4 },
          theme: "DARK",
        },
      }),
    };

    const response = await fetch("https://api.videosdk.live/v2/recordings/start", options);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      logs.push("❌ Invalid JSON from VideoSDK:");
      logs.push(text);
      return res.status(500).json({ success: false, logs });
    }

    if (!response.ok) {
      logs.push("❌ VideoSDK request failed");
      logs.push(JSON.stringify(data));
      return res.status(500).json({ success: false, logs });
    }

    logs.push("✅ Recording started successfully!");
    logs.push(`Recording Session ID: ${data.id}`);
    logs.push("Full VideoSDK response: " + JSON.stringify(data));

    // 4️⃣ Respond to frontend
    res.status(200).json({ success: true, logs, videosdk: data });

  } catch (err) {
    logs.push("💥 Unexpected error: " + err.message);
    res.status(500).json({ success: false, logs });
  }
  }
