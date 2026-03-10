import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const extractFrame = async (videoPath, outputPath) => {
    // Wrap event-based fluent-ffmpeg API in Promise to allow awaiting
    await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                timestamps: ['00:00:01.000'],
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
            })
            .on('end', resolve)
            .on('error', reject);
    });
    return outputPath;
};

export const transcodeToHLS = async (videoPath, outputDir) => {
    if (!existsSync(outputDir)) {
        await fs.mkdir(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'output.m3u8');

    await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .outputOptions([
                '-profile:v baseline',
                '-level 3.0',
                '-start_number 0',
                '-hls_time 10',
                '-hls_list_size 0',
                '-f hls'
            ])
            .output(outputPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });
    return outputDir;
};
