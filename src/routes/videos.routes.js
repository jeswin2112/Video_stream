import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { uploadVideo, getVideos, getVideoById } from '../controllers/videos.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

const upload = multer({
    dest: tempDir,
    limits: { fileSize: 500 * 1024 * 1024 },
});

router.post('/upload', upload.single('video'), uploadVideo);
router.get('/', getVideos);
router.get('/:id', getVideoById);

export default router;
