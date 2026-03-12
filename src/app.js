import express from 'express';
import cors from 'cors';
import { createVideosTable } from './database/schemas/videos.schema.js';
import videosRoutes from './routes/videos.routes.js';
import { APP } from './constants/env.constants.js';

const app = express();

app.use(cors({
    origin: ['https://srs-platform-frontend.vercel.app/', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());

// Initialize Database Schema
createVideosTable();

// Routes
app.use('/videos', videosRoutes);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const server = app.listen(APP.PORT, () => {
    console.log(`Server started on port ${APP.PORT}`);
});

server.timeout = 900000; // 15 minutes for long-running transcoding

