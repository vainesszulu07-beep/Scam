import multer from 'multer';
import cloudinary from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import nextConnect from 'next-connect';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

const handler = nextConnect();
handler.use(upload.single('avatar'));

handler.post(async (req, res) => {
  try {
    const { oldAvatarPublicId } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Delete old avatar
    if (oldAvatarPublicId) {
      await cloudinary.v2.uploader.destroy(oldAvatarPublicId);
    }

    // Upload new avatar
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.v2.uploader.upload_stream(
        { folder: 'avatars', public_id: uuidv4(), overwrite: true, resource_type: 'image' },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded))
      );
      stream.end(file.buffer);
    });

    res.status(200).json({ url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default handler;
export const config = { api: { bodyParser: false } };
