import * as videosService from '../services/videos.service.js';
import * as awsService from '../services/aws.service.js';

export const uploadVideo = async (req, res) => {
    try {
        const { title, description } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: 'Video file is required' });
        if (!title) return res.status(400).json({ error: 'Title is required' });

        const video = await videosService.uploadVideo(file, title, description);
        res.status(201).json({ message: 'Video processed and uploaded successfully', video });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getVideos = async (req, res) => {
    try {
        const videos = await videosService.getVideos();
        res.status(200).json(videos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
};

export const getVideoById = async (req, res) => {
    try {
        const video = await videosService.getVideoById(req.params.id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        res.status(200).json(video);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch video details' });
    }
};

export const deleteVideo = async (req, res) => {
    try {
        // const video = await videosService.getVideoById(req.params.id);
        const success = await videosService.deleteVideo(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Video not found or already deleted' });
        }
        // await awsService.deleteFromS3Url(video.original_url);
        // console.log(video)
        res.status(200).json({ message: 'Video deleted successfully' });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Failed to delete video' });
    }
};

