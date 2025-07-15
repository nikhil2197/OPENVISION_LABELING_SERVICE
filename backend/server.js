const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.vercel.app'] 
    : ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Google Drive folder contents endpoint
app.get('/api/folder/:folderId', async (req, res) => {
  const { folderId } = req.params;
  
  try {
    console.log(`[${new Date().toISOString()}] Fetching folder contents for:`, folderId);
    
    // For now, return mock data based on the folder ID
    // In production, you'd use Google Drive API with proper authentication
    if (folderId === '1mHCx8e4P5zb5gWKxdH2nU6rFYy62uIbz') {
      const mockFiles = [
        { 
          id: '12zaGrjOMlLYTPz7HZCgZu9sU_0spC0RP', 
          name: 'D05_20250616235959.mp4', 
          size: '359 MB', 
          mimeType: 'video/mp4' 
        },
        { 
          id: 'mock_id_2', 
          name: 'D05_20250617025600.mp4', 
          size: '47 MB', 
          mimeType: 'video/mp4' 
        },
        { 
          id: 'mock_id_3', 
          name: 'D05_20250617031901.mp4', 
          size: '1,013.5 MB', 
          mimeType: 'video/mp4' 
        },
        { 
          id: 'mock_id_4', 
          name: 'D05_20250617080646.mp4', 
          size: '1,013.8 MB', 
          mimeType: 'video/mp4' 
        },
        { 
          id: 'mock_id_5', 
          name: 'D05_20250617110913.mp4', 
          size: '1,013.7 MB', 
          mimeType: 'video/mp4' 
        },
        { 
          id: 'mock_id_6', 
          name: 'D05_20250617141044.mp4', 
          size: '1,013.9 MB', 
          mimeType: 'video/mp4' 
        },
        { 
          id: 'mock_id_7', 
          name: 'D05_20250617164951.mp4', 
          size: '1,013.7 MB', 
          mimeType: 'video/mp4' 
        },
        { 
          id: 'mock_id_8', 
          name: 'D05_20250617190622.mp4', 
          size: '848.9 MB', 
          mimeType: 'video/mp4' 
        }
      ];
      
      res.json({ files: mockFiles });
    } else {
      // For other folder IDs, return empty array
      res.json({ files: [] });
    }
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching folder contents:`, error);
    res.status(500).json({ error: 'Failed to fetch folder contents' });
  }
});

// Main video processing endpoint
app.post('/api/snip', async (req, res) => {
  const { video_url, timestamp } = req.body;

  // Validate input
  if (!video_url || !timestamp) {
    return res.status(400).json({ 
      error: 'Missing required parameters: video_url and timestamp' 
    });
  }

  if (timestamp < 60) {
    return res.status(400).json({ 
      error: 'Timestamp must be at least 60 seconds' 
    });
  }

  if (timestamp > 3600) {
    return res.status(400).json({ 
      error: 'Timestamp cannot exceed 3600 seconds (1 hour)' 
    });
  }

  const tempDir = path.join('/tmp', `video-labeling-${uuidv4()}`);
  const inputPath = path.join(tempDir, 'input.mp4');

  try {
    // Create temp directory
    await fs.ensureDir(tempDir);

    console.log(`[${new Date().toISOString()}] Processing request:`, {
      video_url: video_url.substring(0, 50) + '...',
      timestamp,
      tempDir
    });
    
    // Download video to temp file
    const response = await axios({
      method: 'GET',
      url: video_url,
      responseType: 'stream',
      timeout: 300000, // 5 minutes timeout
      maxContentLength: 500 * 1024 * 1024, // 500MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const writer = fs.createWriteStream(inputPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    console.log(`[${new Date().toISOString()}] Video downloaded successfully:`, inputPath);

    // Calculate start time (60 seconds before timestamp)
    const startTime = timestamp - 60;

    // Set response headers for video streaming
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="clip_${Math.floor(timestamp)}s.mp4"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    console.log(`[${new Date().toISOString()}] Starting FFmpeg processing:`, {
      startTime,
      duration: 60,
      outputFormat: 'mp4'
    });

    // Process video with ffmpeg and stream directly to response
    const ffmpegProcess = ffmpeg(inputPath)
      .inputOptions([`-ss ${startTime}`])
      .outputOptions([
        '-t 60',           // Duration: 60 seconds
        '-c copy',         // Copy codecs (fast)
        '-avoid_negative_ts make_zero', // Handle negative timestamps
        '-f mp4',          // Force MP4 format
        '-movflags frag_keyframe+empty_moov' // Optimize for streaming
      ])
      .on('start', (commandLine) => {
        console.log(`[${new Date().toISOString()}] FFmpeg command:`, commandLine);
      })
      .on('progress', (progress) => {
        console.log(`[${new Date().toISOString()}] FFmpeg progress:`, {
          percent: progress.percent,
          timemark: progress.timemark,
          fps: progress.currentFps
        });
      })
      .on('error', (err) => {
        console.error(`[${new Date().toISOString()}] FFmpeg error:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Video processing failed' });
        }
      })
      .on('end', () => {
        console.log(`[${new Date().toISOString()}] Video processing completed successfully`);
      });

    // Pipe to response
    ffmpegProcess.pipe(res, { end: true });

    // Handle response end to clean up
    res.on('close', async () => {
      try {
        await fs.remove(tempDir);
        console.log(`[${new Date().toISOString()}] Cleaned up temp directory:`, tempDir);
      } catch (cleanupError) {
        console.error(`[${new Date().toISOString()}] Error cleaning up:`, cleanupError);
      }
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error processing video:`, error);
    
    // Clean up temp files
    try {
      await fs.remove(tempDir);
    } catch (cleanupError) {
      console.error(`[${new Date().toISOString()}] Error cleaning up temp files:`, cleanupError);
    }

    if (!res.headersSent) {
      if (error.response) {
        res.status(500).json({ 
          error: `Failed to download video: ${error.response.status} ${error.response.statusText}` 
        });
      } else if (error.code === 'ENOTFOUND') {
        res.status(400).json({ error: 'Invalid video URL' });
      } else if (error.code === 'ECONNABORTED') {
        res.status(408).json({ error: 'Request timeout - video too large or slow to download' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
});

// Cleanup temp files on process exit
const cleanup = async () => {
  console.log(`[${new Date().toISOString()}] Cleaning up temp files...`);
  try {
    const tempFiles = await fs.readdir('/tmp');
    for (const file of tempFiles) {
      if (file.startsWith('video-labeling-')) {
        await fs.remove(path.join('/tmp', file));
        console.log(`[${new Date().toISOString()}] Removed temp file:`, file);
      }
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error during cleanup:`, error);
  }
};

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, error);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Video Labeling Backend running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎬 Snip endpoint: http://localhost:${PORT}/api/snip`);
  console.log(`📁 Folder endpoint: http://localhost:${PORT}/api/folder/:folderId`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 