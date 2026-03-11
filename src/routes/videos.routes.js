import express from 'express';
import multer from 'multer';
import { uploadVideo, getVideos, getVideoById, deleteVideo } from '../controllers/videos.controller.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
});

router.post('/upload', upload.single('video'), uploadVideo);
router.get('/', getVideos);
router.get('/:id', getVideoById);
router.delete('/:id', deleteVideo);


export default router;
