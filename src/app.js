import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createVideosTable } from './database/schemas/videos.schema.js';
import videosRoutes from './routes/videos.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Initialize Database Schema
createVideosTable();

// Routes
app.use('/videos', videosRoutes);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
