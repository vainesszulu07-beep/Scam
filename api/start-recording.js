import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

// --- Supabase client (hardcoded service role key) ---
const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpbWVjdWlpeHdnbXBmcGVkeHByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA0MjQ3NCwiZXhwIjoyMDg2NjE4NDc0fQ.735Jlm22UZ3JICXCxsP5CyVIN-Bsn4j0XqFTU61bILg" // Replace with your Supabase service role key
);

// --- VideoSDK credentials (hardcoded) ---
const VIDEOSDK_API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const VIDEOSDK_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a"; // Needed to sign JWT

// --- Generate JWT for VideoSDK v2 API ---
function generateVideoSDKToken() {
  const payload = {
    apikey: VIDEOSDK_API_KEY,
    permissions: ["allow_join", "allow_mod"], // 'allow_mod' needed for recording
    version: 2,
    role: "crawler", // Server-side role
  };
  return jwt.sign(payload, VIDEOSDK_SECRET, { expiresIn: "10m", algorithm: "HS256" });
}

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

    // 2️⃣ Fetch user's VideoSDK room from Supabase
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
      logs.push("❌ Profile missing roomId. Cannot start recording.");
      return res.status(500).json({ success: false, logs });
    }
    logs.push(`📡 Using roomId: ${roomId}`);

    // 3️⃣ Generate JWT for recording
    const token = generateVideoSDKToken();
    logs.push("🔑 JWT generated for VideoSDK recording");

    // 4️⃣ Start recording via VideoSDK v2
    const response = await fetch("https://api.videosdk.live/v2/recordings/start", {
      method: "POST",
      headers: {
        "Authorization": token, // raw JWT, no 'Bearer'
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId,
        config: {
          layout: { type: "GRID", priority: "SPEAKER", gridSize: 4 },
          theme: "DARK",
        },
      }),
    });

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

    res.status(200).json({ success: true, logs, videosdk: data });

  } catch (err) {
    logs.push("💥 Unexpected error: " + err.message);
    res.status(500).json({ success: false, logs });
  }
                                             }
