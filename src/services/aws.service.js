import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';
import fs from 'fs';

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const rekognition = new RekognitionClient({ region: process.env.AWS_REGION });

export const uploadToS3 = async (filePath, key) => {
    const fileStream = fs.createReadStream(filePath);
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: fileStream,
    });
    await s3.send(command);
    return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};

export const checkSensitiveContent = async (imageBuffer) => {
    try {
        const command = new DetectModerationLabelsCommand({
            Image: { Bytes: imageBuffer },
            MinConfidence: 75
        });
        const response = await rekognition.send(command);
        return response.ModerationLabels && response.ModerationLabels.length > 0;
    } catch (error) {
        console.error('AWS Rekognition error:', error);
        return false; // Default to passing on API errors, depending on strictness needs
    }
};
