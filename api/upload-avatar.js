import cloudinary from 'cloudinary';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import nextConnect from 'next-connect'; // optional if using Vercel serverless, for Express-like handlers

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudinary config (use environment variables)
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Handler
const handler = nextConnect();

// Handle POST upload
handler.use(upload.single('avatar')).post(async (req, res) => {
  try {
    const file = req.file;
    const oldAvatarPublicId = req.body.oldAvatarPublicId || null;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old avatar if exists
    if (oldAvatarPublicId) {
      try {
        await cloudinary.v2.uploader.destroy(oldAvatarPublicId);
      } catch (err) {
        console.warn('Failed to delete old avatar:', err.message);
      }
    }

    // Upload new avatar
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.v2.uploader.upload_stream(
        {
          folder: 'avatars',
          public_id: uuidv4(),
          overwrite: true,
          resource_type: 'image',
        },
        (error, uploaded) => {
          if (error) reject(error);
          else resolve(uploaded);
        }
      );
      stream.end(file.buffer);
    });

    res.status(200).json({
      url: result.secure_url,
      public_id: result.public_id,
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

export default handler;
