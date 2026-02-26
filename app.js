import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cloudinary from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudinary config
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Default route → login.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Upload Avatar Route
app.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  try {
    const { oldAvatarPublicId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old avatar if exists
    if (oldAvatarPublicId) {
      await cloudinary.v2.uploader.destroy(oldAvatarPublicId);
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
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
