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

export const uploadVideo = async (file, title, description) => {
    const videoId = uuidv4();
    const s3KeyOriginal = `videos/${videoId}/original-${file.originalname}`;

    // 1. Extract frame & check for sensitive content
    const framePath = path.join(__dirname, `../../temp/${videoId}-frame.jpg`);
    await ffmpegService.extractFrame(file.path, framePath);
    const frameBuffer = await fs.readFile(framePath);

    const isSensitive = await awsService.checkSensitiveContent(frameBuffer);
    await fs.unlink(framePath); // Clean up frame immediately using fs/promises

    if (isSensitive) {
        await fs.unlink(file.path);
        throw new Error('Sensitive content detected. Video upload rejected.');
    }

    // 2. Upload original MP4 to S3
    const originalUrl = await awsService.uploadToS3(file.path, s3KeyOriginal);

    // 3. Transcode to HLS & upload segments to S3
    const hlsDir = path.join(__dirname, `../../temp/${videoId}_hls`);
    await ffmpegService.transcodeToHLS(file.path, hlsDir);
    const hlsUrl = await uploadFilesFromDirToS3(hlsDir, `videos/${videoId}/hls`);

    // 4. Configure Cloudflare Streaming
    let cloudflareId = null;
    try {
        cloudflareId = await configureCloudflareStream(originalUrl);
    } catch (err) {
        console.warn('Cloudflare setup failed, falling back to S3 HLS:', err.message);
    }

    // Cleanup local files
    await fs.rm(hlsDir, { recursive: true, force: true });
    await fs.unlink(file.path);

    // 5. Save to DB
    const sql = `
    INSERT INTO videos (id, title, description, original_url, hls_url, cloudflare_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
    const values = [videoId, title, description, originalUrl, hlsUrl, cloudflareId];
    const { rows } = await query(sql, values);

    return rows[0];
};

export const getVideos = async () => {
    const { rows } = await query('SELECT * FROM videos WHERE deleted_at IS NULL ORDER BY created_at DESC;');
    return rows;
};

export const getVideoById = async (id) => {
    const { rows } = await query('SELECT * FROM videos WHERE id = $1 AND deleted_at IS NULL;', [id]);
    return rows[0];
};
