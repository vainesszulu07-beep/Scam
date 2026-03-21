import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(cors());

// 🔑 VideoSDK keys
const API_KEY = "7b3acbbb-8976-4b84-978a-4533b7b41440";
const API_SECRET = "62db5287e66364a8d97d73cfa1147fd92d4829bdc873648a09f9c640f366770a";

// =======================
// Generate server token (used to create room)
// =======================
function generateServerToken() {
  const payload = { apikey: API_KEY, version: 2 };
  return jwt.sign(payload, API_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

// =======================
// Create room endpoint
// =======================
app.post("/api/create-room", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: "Missing userId" });
  }

  try {
    // 1️⃣ Generate server token
    const serverToken = generateServerToken();

    // 2️⃣ Call VideoSDK API to create a room using server token
    const roomResp = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `room_${userId}`, // optional display name
        metadata: { creator: userId }
      })
    });

    const roomData = await roomResp.json();

    if (!roomResp.ok) {
      return res.status(roomResp.status).json({
        success: false,
        error: "Room creation failed",
        raw: roomData
      });
    }

    // ✅ Return roomId and serverToken (can be used later for host token)
    res.json({
      success: true,
      userId,
      roomId: roomData.roomId,
      serverToken
    });

  } catch (err) {
    console.error("CREATE ROOM ERROR:", err);
    res.status(500).json({ success: false, error: err.message, stack: err.stack });
  }
});

// =======================
// Test route
// =======================
app.get("/", (req, res) => res.send("VideoSDK backend running ✅"));

// =======================
// Start server
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
