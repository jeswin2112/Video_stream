import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { Readable } from 'stream';
import { query } from '../database/database.connection.js';
import * as awsService from './aws.service.js';
import * as ffmpegService from './ffmpeg.service.js';
import { CLOUDFLARE, S3_BASE_URL } from '../constants/env.constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configureCloudflareStream = async (originalUrl) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE.ACCOUNT_ID}/stream/copy`;
    const response = await axios.post(url, { url: originalUrl }, {
        headers: { 'Authorization': `Bearer ${CLOUDFLARE.API_TOKEN}` }
    });
    return response.data.result.uid;
};

const uploadFilesFromDirToS3 = async (dir, prefix) => {
    const files = await fs.readdir(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const fileBuffer = await fs.readFile(filePath);
        await awsService.uploadToS3(fileBuffer, `${prefix}/${file}`);
    }
    return `${S3_BASE_URL}/${prefix}/output.m3u8`;
};

const checkSensitiveContent = async (videoId, fileBuffer) => {
    const framePath = path.join(__dirname, `../../temp/${videoId}-frame.jpg`);
    const fileStream = Readable.from(fileBuffer);

    try {
        await ffmpegService.extractFrame(fileStream, framePath);
        const frameBuffer = await fs.readFile(framePath);
        const isSensitive = await awsService.checkSensitiveContent(frameBuffer);

        if (isSensitive) {
            throw new Error('Sensitive content detected. Video upload rejected.');
        }
    } finally {
        await fs.unlink(framePath).catch(() => { });
    }
};

const processHLS = async (videoId, fileBuffer) => {
    const hlsDir = path.join(__dirname, `../../temp/${videoId}_hls`);
    const fileStream = Readable.from(fileBuffer);

    try {
        await ffmpegService.transcodeToHLS(fileStream, hlsDir);
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

    // 1. Extract frame & check for sensitive content
    await checkSensitiveContent(videoId, file.buffer);

    // 2. Upload original MP4 to S3 directly from Memory
    const s3KeyOriginal = `videos/${videoId}/original-${file.originalname}`;
    const originalUrl = await awsService.uploadToS3(file.buffer, s3KeyOriginal, file.mimetype);

    // 3. Transcode to HLS & upload segments to S3
    const hlsUrl = await processHLS(videoId, file.buffer);

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
};

export const getVideos = async () => {
    const { rows } = await query('SELECT * FROM videos WHERE deleted_at IS NULL ORDER BY created_at DESC;');
    return rows;
};

export const getVideoById = async (id) => {
    const { rows } = await query('SELECT * FROM videos WHERE id = $1 AND deleted_at IS NULL;', [id]);
    return rows[0];
};
