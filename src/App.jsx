import React, { useState, useEffect, useRef, useMemo } from "react";
import {
MeetingProvider,
MeetingConsumer,
useMeeting,
useParticipant,
Constants,
} from "@videosdk.live/react-sdk";
import { createClient } from "@supabase/supabase-js";

// --- Configuration ---
const supabase = createClient(
"https://eimecuiixwgmpfpedxpr.supabase.co",
"sb_publishable_yFjk-cShSqVzlQye7DqRdg_F3AJ39ou"
);

// --- Component: Participant View ---
// This handles the actual video rendering for each participant
function ParticipantView({ participantId }) {
const videoRef = useRef(null);
const { webcamStream, webcamOn, isLocal } = useParticipant(participantId);

useEffect(() => {
if (webcamRef.current && webcamStream && webcamOn) {
const mediaStream = new MediaStream();
mediaStream.addTrack(webcamStream.track);
videoRef.current.srcObject = mediaStream;
videoRef.current.play().catch((e) => console.error("Video play error", e));
} else {
videoRef.current.srcObject = null;
}
}, [webcamStream, webcamOn]);

return (
<video
ref={videoRef}
autoPlay
muted={isLocal}
playsInline
style={{ width: "100%", height: "55vh", background: "black" }}
/>
);
}

// --- Component: Stream Controls ---
function StreamControls({ roomId, hostToken, userId }) {
const [status, setStatus] = useState("Ready...");
const [cameras, setCameras] = useState([]);

const { join, leave, participants, localParticipant, changeWebcam } = useMeeting({
onMeetingJoined: () => {
setStatus("🔴 LIVE");
saveStreamToDB();
},
onMeetingLeft: () => {
setStatus("Stream Ended");
clearStreamFromDB();
},
onError: (error) => setStatus(❌ ${error.message}),
});

// Load available cameras
useEffect(() => {
navigator.mediaDevices.enumerateDevices().then((devices) => {
const videoDevices = devices.filter((d) => d.kind === "videoinput");
setCameras(videoDevices);
});
}, []);

const saveStreamToDB = async () => {
await supabase.from("profile").update({
is_live: true,
videosdk_room_id: roomId,
}).eq("id", userId);
};

const clearStreamFromDB = async () => {
await supabase.from("profile").update({
is_live: false,
}).eq("id", userId);
};

return (
<div style={{ textAlign: "center", fontFamily: "Arial" }}>
<h2>🎥 Go Live (React)</h2>

{/* Show local participant video */}  
  {localParticipant ? (  
    <ParticipantView participantId={localParticipant.id} />  
  ) : (  
    <div style={{ height: "55vh", background: "black" }} />  
  )}  

  <div style={{ padding: "10px", background: "white" }}>{status}</div>  

  {!localParticipant ? (  
    <button   
      onClick={join}   
      style={{ background: "green", color: "white", padding: "12px", width: "90%", borderRadius: "8px", margin: "10px" }}  
    >  
      Start Stream  
    </button>  
  ) : (  
    <>  
      <button   
        onClick={leave}   
        style={{ background: "red", color: "white", padding: "12px", width: "90%", borderRadius: "8px", margin: "10px" }}  
      >  
        Stop Stream  
      </button>  

      <select   
        onChange={(e) => changeWebcam(e.target.value)}  
        style={{ padding: "12px", width: "90%", borderRadius: "8px", background: "#007bff", color: "white" }}  
      >  
        {cameras.map((cam) => (  
          <option key={cam.deviceId} value={cam.deviceId}>  
            {cam.label || "Camera"}  
          </option>  
        ))}  
      </select>  
    </>  
  )}  
</div>

);
}

// --- Main App Entry ---
export default function GoLiveApp() {
const [meetingConfig, setMeetingConfig] = useState(null);
const [userId, setUserId] = useState(null);

const initStream = async () => {
const { data: { session } } = await supabase.auth.getSession();
if (!session) return alert("Please Login");

setUserId(session.user.id);  

const res = await fetch("https://scamming-lg3v.onrender.com/api/create-room", {  
  method: "POST",  
  headers: { "Content-Type": "application/json" },  
  body: JSON.stringify({ userId: session.user.id })  
});  
const data = await res.json();  
  
if (data.success) {  
  setMeetingConfig({  
    roomId: data.roomId,  
    token: data.hostToken,  
  });  
}

};

return meetingConfig ? (
<MeetingProvider
config={{
meetingId: meetingConfig.roomId,
micEnabled: true,
webcamEnabled: true,
name: "Host",
}}
token={meetingConfig.token}
>
<StreamControls   
roomId={meetingConfig.roomId}   
hostToken={meetingConfig.token}   
userId={userId}   
/>
</MeetingProvider>
) : (
<div style={{ textAlign: "center", padding: "50px" }}>
<button onClick={initStream} style={{ padding: "20px", fontSize: "18px" }}>
Initialize Meeting Setup
</button>
</div>
);
}
