import cloudinary from "cloudinary";
import multer from "multer";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

export const config = {
api: { bodyParser: false }
};

// Supabase using Secret Key
const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SECRET_KEY,
{
auth: {
autoRefreshToken: false,
persistSession: false
}
}
);

// Cloudinary configuration
cloudinary.v2.config({
cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
api_key: process.env.CLOUDINARY_API_KEY,
api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
dest: "/tmp/",
limits: {
fileSize: 10 * 1024 * 1024
}
});

function multerMiddleware(req, res) {
return new Promise((resolve, reject) => {
upload.single("file")(req, res, (err) => {
if (err) reject(err);
else resolve(req.file);
});
});
}

export default async function handler(req, res) {
if (req.method !== "POST") {
return res.status(405).json({
success: false,
error: "Use POST only"
});
}

let file;

try {

// 1. Receive image and form data  
file = await multerMiddleware(req, res);  

if (!file) {  
  return res.status(400).json({  
    success: false,  
    error: "No file uploaded"  
  });  
}  

// 2. Get user_id from frontend  
const userId = req.body.user_id;  

if (!userId) {  
  return res.status(400).json({  
    success: false,  
    error: "Missing user_id"  
  });  
}  

// 3. Check if user_id exists in dashboard  
const { data: dashboardUser, error: dbError } =  
  await supabase  
    .from("dashboard")  
    .select("user_id")  
    .eq("user_id", userId)  
    .maybeSingle();  

if (dbError) {  
  console.error("Dashboard lookup error:", dbError);  

  return res.status(500).json({  
    success: false,  
    error: "Database verification failed"  
  });  
}  

if (!dashboardUser) {  
  return res.status(403).json({  
    success: false,  
    error: "User ID not registered in dashboard"  
  });  
}  

// 4. Generate unique advertisement ID  
const publicId = `ad_${userId}_${Date.now()}`;  

// 5. Upload image to Cloudinary ads folder  
const result = await cloudinary.v2.uploader.upload(  
  file.path,  
  {  
    folder: "ads",  
    public_id: publicId,  
    overwrite: false,  
    invalidate: true,  
    transformation: [  
      { width: 800, height: 800, crop: "limit" },  
      { quality: "auto" },  
      { fetch_format: "auto" }  
    ]  
  }  
);  

// 6. Return image URL  
return res.status(200).json({  
  success: true,  
  message: "Advertisement uploaded successfully",  
  url: result.secure_url,  
  publicId: result.public_id,  
  userId: userId  
});

} catch (err) {
console.error("Upload error:", err);

return res.status(500).json({  
  success: false,  
  error: "Advertisement upload failed"  
});

} finally {

// 7. Delete temporary file  
if (file?.path) {  
  await fs.promises.unlink(file.path).catch(() => {});  
}

}
}
