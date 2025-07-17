const express = require('express');
const cors = require('cors');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

// Google Cloud Storage setup for signed URL uploads
const { Storage } = require('@google-cloud/storage');
const storage = new Storage({ keyFilename: path.join(__dirname, 'gcs-key.json') });
const GCS_BUCKET = process.env.GCS_BUCKET || 'my-video-uploads-yourproject';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Session storage for uploaded videos (in-memory, not persistent)
const sessionVideos = new Map();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS middleware - allow all origins for now
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Session-Id', 'Authorization', 'Range']
}));

app.use(express.json({ limit: '10mb' }));

// Multer configuration for file uploads
const multerStorage = multer.memoryStorage();
const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log(`[${new Date().toISOString()}] Processing file:`, file.originalname, file.mimetype);
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});



// File upload endpoint
app.post('/api/upload', upload.single('video'), async (req, res) => {
  console.log(`[${new Date().toISOString()}] Upload endpoint hit`);
  
  try {
    console.log(`[${new Date().toISOString()}] Upload request received:`, {
      hasFile: !!req.file,
      headers: req.headers,
      body: req.body
    });

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const sessionId = req.headers['x-session-id'] || uuidv4();
    const videoId = uuidv4();
    
    console.log(`[${new Date().toISOString()}] Uploading video:`, {
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      sessionId,
      videoId
    });

    // Store video in session memory
    sessionVideos.set(videoId, {
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      sessionId,
      uploadedAt: new Date().toISOString()
    });

    // Clean up old videos from the same session (keep only the latest)
    for (const [key, video] of sessionVideos.entries()) {
      if (video.sessionId === sessionId && key !== videoId) {
        sessionVideos.delete(key);
        console.log(`[${new Date().toISOString()}] Cleaned up old video:`, key);
      }
    }

    res.json({
      success: true,
      videoId,
      sessionId,
      originalName: req.file.originalname,
      size: req.file.size,
      message: 'Video uploaded successfully'
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Upload error:`, error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error.message || 'Failed to upload video' 
      });
    }
  }
});



// Video stream endpoint for uploaded videos
app.get('/api/uploaded-video/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    const video = sessionVideos.get(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    console.log(`[${new Date().toISOString()}] Streaming uploaded video:`, videoId);

    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', video.mimetype);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Content-Length', video.size);

    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : video.size - 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${video.size}`);
      res.setHeader('Content-Length', end - start + 1);
      
      res.end(video.buffer.slice(start, end + 1));
    } else {
      res.end(video.buffer);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error streaming uploaded video:`, error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
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

// Google Drive video proxy endpoint
app.get('/api/video/:fileId', async (req, res) => {
  const { fileId } = req.params;
  
  try {
    console.log(`[${new Date().toISOString()}] Proxying video for file ID:`, fileId);
    
    // Try multiple Google Drive URL formats with better handling
    const urlFormats = [
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&uuid=`,
      `https://drive.google.com/uc?export=download&id=${fileId}`,
      `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
      `https://drive.google.com/open?id=${fileId}`
    ];
    
    // Additional fallback: try to extract direct download URL from Google Drive
    const fallbackUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    let response = null;
    let lastError = null;
    let isHtmlContent = false;
    
    // Try each URL format until one works
    for (const videoUrl of urlFormats) {
      try {
        console.log(`[${new Date().toISOString()}] Trying URL:`, videoUrl);
        
        // First, try to get headers to check content type
        const headResponse = await axios({
          method: 'HEAD',
          url: videoUrl,
          timeout: 10000,
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 400;
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'video/mp4,video/*,*/*;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });
        
        const contentType = headResponse.headers['content-type'] || '';
        console.log(`[${new Date().toISOString()}] HEAD response - Content-Type:`, contentType);
        
        // Check if we're getting HTML instead of video
        if (contentType.includes('text/html')) {
          console.log(`[${new Date().toISOString()}] Skipping HTML response from:`, videoUrl);
          isHtmlContent = true;
          continue;
        }
        
        // If content type looks good, proceed with full request
        response = await axios({
          method: 'GET',
          url: videoUrl,
          responseType: 'stream',
          timeout: 30000,
          maxRedirects: 5,
          validateStatus: function (status) {
            return status >= 200 && status < 400;
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'video/mp4,video/*,*/*;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://drive.google.com/'
          }
        });
        
        console.log(`[${new Date().toISOString()}] Success with URL:`, videoUrl);
        console.log(`[${new Date().toISOString()}] Response status:`, response.status);
        console.log(`[${new Date().toISOString()}] Content-Type:`, response.headers['content-type']);
        
        // Double-check we're not getting HTML in the actual response
        const actualContentType = response.headers['content-type'] || '';
        if (actualContentType.includes('text/html')) {
          console.log(`[${new Date().toISOString()}] Got HTML in actual response, trying next URL`);
          isHtmlContent = true;
          continue;
        }
        
        break; // Success, exit the loop
        
      } catch (error) {
        console.log(`[${new Date().toISOString()}] Failed with URL:`, videoUrl, error.message);
        lastError = error;
        continue; // Try next URL
      }
    }
    
    if (!response) {
      // Try fallback method: extract download URL from Google Drive HTML
      try {
        console.log(`[${new Date().toISOString()}] Trying fallback method for file ID:`, fileId);
        
        const htmlResponse = await axios({
          method: 'GET',
          url: fallbackUrl,
          timeout: 15000,
          maxRedirects: 5,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });
        
        const html = htmlResponse.data;
        console.log(`[${new Date().toISOString()}] Got HTML response, length:`, html.length);
        
        // Look for various patterns in the HTML
        const patterns = [
          /href="([^"]*uc[^"]*export=download[^"]*)"/,
          /action="([^"]*uc[^"]*export=download[^"]*)"/,
          /window\.location\.href\s*=\s*['"]([^'"]*uc[^'"]*export=download[^'"]*)['"]/,
          /downloadUrl\s*=\s*['"]([^'"]*uc[^'"]*export=download[^'"]*)['"]/
        ];
        
        let downloadUrl = null;
        let confirmValue = null;
        
        // Try to find download URL
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match) {
            downloadUrl = match[1].replace(/&amp;/g, '&');
            console.log(`[${new Date().toISOString()}] Found download URL with pattern:`, downloadUrl);
            break;
          }
        }
        
        // Look for confirm value
        const confirmPatterns = [
          /name="confirm" value="([^"]*)"/,
          /confirm=([^&"]*)/,
          /"confirm":"([^"]*)"/
        ];
        
        for (const pattern of confirmPatterns) {
          const match = html.match(pattern);
          if (match) {
            confirmValue = match[1];
            console.log(`[${new Date().toISOString()}] Found confirm value:`, confirmValue);
            break;
          }
        }
        
        // If we found a download URL, try to get the video
        if (downloadUrl) {
          console.log(`[${new Date().toISOString()}] Attempting download with URL:`, downloadUrl);
          
          const downloadOptions = {
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'video/mp4,video/*,*/*;q=0.9',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Referer': fallbackUrl
            }
          };
          
          // If we have a confirm value, use POST method
          if (confirmValue) {
            downloadOptions.method = 'POST';
            downloadOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            downloadOptions.data = `confirm=${confirmValue}`;
          }
          
          response = await axios(downloadOptions);
          
          console.log(`[${new Date().toISOString()}] Fallback success - Response status:`, response.status);
          console.log(`[${new Date().toISOString()}] Content-Type:`, response.headers['content-type']);
          
          // Check if we're still getting HTML
          const contentType = response.headers['content-type'] || '';
          if (contentType.includes('text/html')) {
            console.log(`[${new Date().toISOString()}] Still getting HTML in fallback response`);
            response = null; // Reset to try other methods
          }
        } else {
          console.log(`[${new Date().toISOString()}] No download URL found in HTML`);
        }
      } catch (fallbackError) {
        console.log(`[${new Date().toISOString()}] Fallback method failed:`, fallbackError.message);
      }
    }
    
    if (!response) {
      // Try one more approach: direct download with different parameters
      try {
        console.log(`[${new Date().toISOString()}] Trying direct download approach for file ID:`, fileId);
        
        const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
        response = await axios({
          method: 'GET',
          url: directUrl,
          responseType: 'stream',
          timeout: 30000,
          maxRedirects: 10,
          validateStatus: function (status) {
            return status >= 200 && status < 400;
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'video/mp4,video/*,*/*;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
          }
        });
        
        console.log(`[${new Date().toISOString()}] Direct download success - Response status:`, response.status);
        console.log(`[${new Date().toISOString()}] Content-Type:`, response.headers['content-type']);
        
        // Check if we're still getting HTML
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          console.log(`[${new Date().toISOString()}] Still getting HTML in direct download`);
          response = null;
        }
      } catch (directError) {
        console.log(`[${new Date().toISOString()}] Direct download failed:`, directError.message);
      }
    }
    
    if (!response) {
      if (isHtmlContent) {
        throw new Error(`Google Drive returned HTML instead of video for file ID: ${fileId}. This usually means:
1. The file is not publicly accessible (check sharing settings)
2. The file requires authentication
3. The file has been deleted or moved
4. Google Drive is blocking automated access

Please ensure the file is shared with "Anyone with the link can view" permissions.`);
      }
      throw lastError || new Error(`Failed to access video file ${fileId}. All download methods failed.`);
    }

    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    
    // Copy content length if available
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // Handle range requests for video seeking
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end || ''}/${response.headers['content-length'] || '*'}`);
    }

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Pipe the video stream to the response
    response.data.pipe(res);
    
    // Handle stream errors
    response.data.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Video stream error:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Video stream error' });
      }
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error proxying video:`, error);
    
    if (error.response) {
      console.error(`[${new Date().toISOString()}] Response status:`, error.response.status);
      console.error(`[${new Date().toISOString()}] Response headers:`, error.response.headers);
    }
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to load video',
        details: error.message 
      });
    }
  }
});

// Main video processing endpoint
app.post('/api/snip', async (req, res) => {
  console.log(`[${new Date().toISOString()}] /api/snip request received:`, {
    body: req.body,
    headers: req.headers,
    method: req.method,
    url: req.url
  });

  const { video_url, timestamp, video_id } = req.body;

  // Validate input
  if ((!video_url && !video_id) || !timestamp) {
    return res.status(400).json({ 
      error: 'Missing required parameters: either video_url or video_id, and timestamp' 
    });
  }

  if (timestamp < 60) {
    return res.status(400).json({ 
      error: 'Timestamp must be at least 60 seconds' 
    });
  }

  // Remove the 3600 second limit - allow any timestamp as long as it's at least 60 seconds
  // if (timestamp > 3600) {
  //   return res.status(400).json({ 
  //     error: 'Timestamp cannot exceed 3600 seconds (1 hour)' 
  //   });
  // }

  const tempDir = path.join('/tmp', `video-labeling-${uuidv4()}`);
  const inputPath = path.join(tempDir, 'input.mp4');

  try {
    // Create temp directory
    await fs.ensureDir(tempDir);

    console.log(`[${new Date().toISOString()}] Processing request:`, {
      video_url: video_url ? video_url.substring(0, 50) + '...' : 'uploaded video',
      video_id,
      timestamp,
      tempDir
    });
    
    // Handle uploaded video or download from URL
    if (video_id) {
      // Process uploaded video from session storage
      const video = sessionVideos.get(video_id);
      if (!video) {
        throw new Error('Uploaded video not found in session');
      }

      console.log(`[${new Date().toISOString()}] Processing uploaded video:`, {
        originalName: video.originalName,
        size: video.size
      });

      // Write uploaded video buffer to temp file
      await fs.writeFile(inputPath, video.buffer);
      
    } else {
      // Download video from URL to temp file
      const response = await axios({
        method: 'GET',
        url: video_url,
        responseType: 'stream',
        timeout: 300000, // 5 minutes timeout
        maxContentLength: 2 * 1024 * 1024 * 1024, // 2GB limit
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
    }

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
      if (error.message === 'Uploaded video not found in session') {
        res.status(400).json({ error: 'Video not found in session. Please upload a video first.' });
      } else if (error.response) {
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

// Cleanup session videos endpoint
app.delete('/api/cleanup-session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  try {
    let cleanedCount = 0;
    for (const [key, video] of sessionVideos.entries()) {
      if (video.sessionId === sessionId) {
        sessionVideos.delete(key);
        cleanedCount++;
      }
    }
    
    console.log(`[${new Date().toISOString()}] Cleaned up ${cleanedCount} videos for session:`, sessionId);
    res.json({ success: true, cleanedCount });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error cleaning up session:`, error);
    res.status(500).json({ error: 'Failed to clean up session' });
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
    
    // Clear session videos
    sessionVideos.clear();
    console.log(`[${new Date().toISOString()}] Cleared session videos`);
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

// Signed URL endpoint for direct uploads to GCS
app.post('/api/upload-url', async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType) {
    return res.status(400).json({ error: 'filename & contentType required' });
  }
  try {
    const file = storage.bucket(GCS_BUCKET).file(filename);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 30 * 60 * 1000, // 30 minutes
      contentType,
    });
    res.json({ uploadUrl });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Signed URL endpoint for direct downloads from GCS (optional)
app.get('/api/download-url', async (req, res) => {
  const { filename } = req.query;
  if (!filename) {
    return res.status(400).json({ error: 'filename required' });
  }
  try {
    const file = storage.bucket(GCS_BUCKET).file(filename);
    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });
    res.json({ downloadUrl });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error(`[${new Date().toISOString()}] Multer error:`, error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 2GB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }
  
  if (error.message === 'Only video files are allowed') {
    return res.status(400).json({ error: 'Only video files are allowed' });
  }
  
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
  console.log(`📤 Upload endpoint: http://localhost:${PORT}/api/upload`);
  console.log(`🎬 Snip endpoint: http://localhost:${PORT}/api/snip`);
  console.log(`📁 Folder endpoint: http://localhost:${PORT}/api/folder/:folderId`);
  console.log(`🎥 Video proxy: http://localhost:${PORT}/api/video/:fileId`);
  console.log(`🎥 Uploaded video: http://localhost:${PORT}/api/uploaded-video/:videoId`);
  console.log(`🧹 Cleanup endpoint: http://localhost:${PORT}/api/cleanup-session/:sessionId`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 