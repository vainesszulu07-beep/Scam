<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Upload Video</title>

<style>
body {
  font-family: sans-serif;
  max-width: 600px;
  margin: auto;
  padding: 20px;
  background: #f0f2f5;
}

h2 { text-align: center; }

a.back-arrow {
  display: inline-block;
  margin-bottom: 10px;
  font-size: 20px;
  text-decoration: none;
  color: #1877f2;
}

button {
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  margin: 4px 2px;
}

.primary { background: #1877f2; color: white; }
.danger { background: crimson; color: white; }

#previewContainer {
  margin-top: 15px;
  text-align: center;
  position: relative; /* for overlay */
}

#previewContainer video {
  max-width: 100%;
  border-radius: 10px;
  display: block;
  margin: auto;
}

#uploadProgressOverlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: none;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: white;
  font-size: 22px;
  border-radius: 10px;
}

#uploadProgressOverlay .spinner {
  border: 4px solid rgba(255,255,255,0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

#uploadProgressOverlay button {
  margin-top: 10px;
}

@keyframes spin { to { transform: rotate(360deg); } }

#processingOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: none;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  z-index: 999;
}

#processingOverlay .spinner {
  border: 4px solid rgba(255,255,255,0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}
</style>
</head>
<body>

<a href="manage.html" class="back-arrow">← Back to Manage</a>
<h2>Upload Video</h2>

<input type="file" id="videoFile" accept="video/*">

<div id="previewContainer">
  <video id="videoPreview" controls></video>
  <div id="uploadProgressOverlay">
    <div class="spinner"></div>
    <span id="progressPercent">0%</span>
    <button id="cancelUploadBtn" class="danger">Cancel Upload</button>
  </div>
</div>

<button id="uploadBtn" class="primary" style="width:100%; margin-top:15px;">Upload Video</button>

<div id="processingOverlay">
  <div>
    <div class="spinner"></div>
    Processing Video...
  </div>
</div>

<script type="module">
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://eimecuiixwgmpfpedxpr.supabase.co",
  "sb_publishable_yFjk-cShSqVzlQye7DqRdg_F3AJ39ou"
);

const videoFileEl = document.getElementById("videoFile");
const videoPreviewEl = document.getElementById("videoPreview");
const uploadBtn = document.getElementById("uploadBtn");
const overlay = document.getElementById("processingOverlay");

const uploadProgressOverlay = document.getElementById("uploadProgressOverlay");
const progressPercent = document.getElementById("progressPercent");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");

let currentUserId;
let selectedFile = null;
let currentXHR = null;

/* AUTH */
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = "index.html"; return; }
  currentUserId = session.user.id;
})();

/* VIDEO SELECT & PREVIEW */
videoFileEl.addEventListener("change", (e) => {
  selectedFile = e.target.files[0];
  if (!selectedFile) return;

  if (selectedFile.size > 50 * 1024 * 1024) { // 50 MB max
    alert("Video is too large!");
    selectedFile = null;
    videoPreviewEl.src = "";
    return;
  }

  const url = URL.createObjectURL(selectedFile);
  videoPreviewEl.src = url;
});

/* CANCEL UPLOAD */
cancelUploadBtn.onclick = () => {
  if (currentXHR) {
    currentXHR.abort();
    alert("Upload canceled.");
    uploadProgressOverlay.style.display = "none";
    currentXHR = null;
  }
};

/* UPLOAD VIDEO */
uploadBtn.onclick = async () => {
  if (!selectedFile) return alert("Select a video first");

  overlay.style.display = "flex";
  uploadProgressOverlay.style.display = "flex";
  progressPercent.textContent = "0%";

  try {
    // Get signed payload from backend
    const { signature, timestamp, apiKey, cloudName } = await fetch("/api/video.js").then(r => r.json());

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    formData.append("folder", "videos");

    // Use XMLHttpRequest to track progress
    currentXHR = new XMLHttpRequest();
    currentXHR.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

    currentXHR.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        progressPercent.textContent = percent + "%";
      }
    };

    const uploadPromise = new Promise((resolve, reject) => {
      currentXHR.onload = () => {
        if (currentXHR.status >= 200 && currentXHR.status < 300) {
          resolve(JSON.parse(currentXHR.responseText));
        } else {
          reject(new Error("Upload failed"));
        }
      };
      currentXHR.onerror = () => reject(new Error("Upload error"));
      currentXHR.send(formData);
    });

    const videoData = await uploadPromise;

    // Save URL to Supabase
    const { error } = await supabase.from("profile").update({
      video_url: videoData.secure_url,
      video_public_id: videoData.public_id
    }).eq("id", currentUserId);

    if (error) throw error;

    alert("Video uploaded successfully!");
    window.location.href = "profile.html";

  } catch (err) {
    if (err.name === "AbortError") {
      console.log("Upload canceled by user.");
    } else {
      console.error(err);
      alert("Error uploading video: " + err.message);
    }
  } finally {
    overlay.style.display = "none";
    uploadProgressOverlay.style.display = "none";
    currentXHR = null;
  }
};
</script>
</body>
</html>
