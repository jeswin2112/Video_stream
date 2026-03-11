import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { RekognitionClient, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';
import { AWS, S3_BASE_URL } from '../constants/env.constants.js';

const s3 = new S3Client({
    region: AWS.REGION,
    credentials: {
        accessKeyId: AWS.ACCESS_KEY_ID,
        secretAccessKey: AWS.SECRET_ACCESS_KEY
    }
});

const rekognition = new RekognitionClient({ region: AWS.REGION });

export const uploadToS3 = async (fileBuffer, key, mimetype = 'application/octet-stream') => {
    const command = new PutObjectCommand({
        Bucket: AWS.S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: mimetype,
    });
    await s3.send(command);
    return `${S3_BASE_URL}/${key}`;
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



export const deleteFileFromS3Url = async (fileUrl) => {
    try {
        const url = new URL(fileUrl);
        const key = url.pathname.substring(1);
        const bucket = url.hostname.split(".")[0];

        await s3.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: key
        }));
        return true;
    } catch (error) {
        console.error('AWS Rekognition error:', error);
        return false;
    }
};