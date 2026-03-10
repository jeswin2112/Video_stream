import 'dotenv/config';

export const APP = {
    PORT: process.env.PORT || 3000,
};

export const DB = {
    URL: process.env.DATABASE_URL,
};

export const AWS = {
    REGION: process.env.AWS_REGION,
    ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    S3_BUCKET: process.env.AWS_S3_BUCKET,
};

export const CLOUDFLARE = {
    ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
    API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
};

export const S3_BASE_URL = `https://${AWS.S3_BUCKET}.s3.${AWS.REGION}.amazonaws.com`;
