import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { query } from '../database/database.connection.js';
import * as awsService from './aws.service.js';
import * as ffmpegService from './ffmpeg.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configureCloudflareStream = async (originalUrl) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/copy`;
    const response = await axios.post(url, { url: originalUrl }, {
        headers: { 'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` }
    });
    return response.data.result.uid;
};

const uploadFilesFromDirToS3 = async (dir, prefix) => {
    const files = await fs.readdir(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        await awsService.uploadToS3(filePath, `${prefix}/${file}`);
    }
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${prefix}/output.m3u8`;
};

const checkSensitiveContent = async (videoId, filePath) => {
    const framePath = path.join(__dirname, `../../temp/${videoId}-frame.jpg`);
    try {
        await ffmpegService.extractFrame(filePath, framePath);
        const frameBuffer = await fs.readFile(framePath);
        const isSensitive = await awsService.checkSensitiveContent(frameBuffer);

        if (isSensitive) {
            throw new Error('Sensitive content detected. Video upload rejected.');
        }
    } finally {
        await fs.unlink(framePath).catch(() => { });
    }
};

const processHLS = async (videoId, filePath) => {
    const hlsDir = path.join(__dirname, `../../temp/${videoId}_hls`);
    try {
        await ffmpegService.transcodeToHLS(filePath, hlsDir);
        return await uploadFilesFromDirToS3(hlsDir, `videos/${videoId}/hls`);
    } finally {
        await fs.rm(hlsDir, { recursive: true, force: true }).catch(() => { });
    }
};

const setupCloudflareStream = async (originalUrl) => {
    try {
        return await configureCloudflareStream(originalUrl);
    } catch (err) {
        console.warn('Cloudflare setup failed, falling back to S3 HLS:', err.message);
        return null;
    }
};

const saveVideoMetadata = async (videoId, title, description, originalUrl, hlsUrl, cloudflareId) => {
    const sql = `
    INSERT INTO videos (id, title, description, original_url, hls_url, cloudflare_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
    const values = [videoId, title, description, originalUrl, hlsUrl, cloudflareId];
    const { rows } = await query(sql, values);
    return rows[0];
};

export const uploadVideo = async (file, title, description) => {
    const videoId = uuidv4();

    try {
        // 1. Extract frame & check for sensitive content
        await checkSensitiveContent(videoId, file.path);

        // 2. Upload original MP4 to S3
        const s3KeyOriginal = `videos/${videoId}/original-${file.originalname}`;
        const originalUrl = await awsService.uploadToS3(file.path, s3KeyOriginal);

        // 3. Transcode to HLS & upload segments to S3
        const hlsUrl = await processHLS(videoId, file.path);

        // 4. Configure Cloudflare Streaming
        const cloudflareId = await setupCloudflareStream(originalUrl);

        // 5. Save to DB
        return await saveVideoMetadata(
            videoId,
            title,
            description,
            originalUrl,
            hlsUrl,
            cloudflareId
        );
    } finally {
        // Cleanup local uploaded file
        if (file && file.path) {
            await fs.unlink(file.path).catch(err => console.warn('Failed to clean up original file:', err.message));
        }
    }
};

export const getVideos = async () => {
    const { rows } = await query('SELECT * FROM videos WHERE deleted_at IS NULL ORDER BY created_at DESC;');
    return rows;
};

export const getVideoById = async (id) => {
    const { rows } = await query('SELECT * FROM videos WHERE id = $1 AND deleted_at IS NULL;', [id]);
    return rows[0];
};
