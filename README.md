# 🎬 Video Labeling Service

A lightweight tool for creating 60-second video clips from uploaded videos. Users can upload videos up to 2GB, watch them in the player, click "Mark Event" at any moment, and receive a downloadable clip ending at that timestamp.

## 🏗️ Architecture

- **Frontend**: Next.js (deployed on Vercel)
- **Backend**: Node.js + Express (deployed on Render)
- **Video Processing**: FFmpeg for clipping and streaming
- **Storage**: Session-only memory storage for uploaded videos (no persistent storage)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- FFmpeg (handled by ffmpeg-static in backend)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd labeling_service
   npm install
   ```

2. **Start both frontend and backend:**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001

3. **Test the application:**
   - Open http://localhost:3000
   - Upload a video file (up to 2GB)
   - Watch the video and click "Mark Event"
   - Download your 60-second clip!

## 🎯 How It Works

1. **Upload**: Select a video file from your computer (up to 2GB)
2. **Session Storage**: Video is stored in server memory (session-only, not persistent)
3. **Playback**: Video plays in browser using ReactPlayer
4. **Event Marking**: User clicks "Mark Event" at desired timestamp
5. **Processing**: Backend processes the uploaded video, clips 60s ending at timestamp
6. **Delivery**: 60-second clip streams directly to user's browser

## 🔧 API Endpoints

### `POST /api/upload`

Uploads a video file to session storage.

**Request:**
- `Content-Type: multipart/form-data`
- `video`: Video file (up to 2GB)
- `X-Session-Id`: Session identifier (optional, auto-generated if not provided)

**Response:**
```json
{
  "success": true,
  "videoId": "uuid",
  "sessionId": "session_uuid",
  "originalName": "video.mp4",
  "size": 1048576,
  "message": "Video uploaded successfully"
}
```

### `GET /api/uploaded-video/:videoId`

Streams an uploaded video from session storage.

**Response:**
- `Content-Type: video/mp4` (or original mime type)
- Video stream with range request support

### `POST /api/snip`

Creates a 60-second video clip ending at the specified timestamp.

**Request:**
```json
{
  "video_url": "https://drive.google.com/uc?export=download&id=FILE_ID",
  "timestamp": 132.4
}
```

OR for uploaded videos:
```json
{
  "video_id": "uploaded_video_uuid",
  "timestamp": 132.4
}
```

**Response:**
- `Content-Type: video/mp4`
- `Content-Disposition: attachment; filename="clip_132s.mp4"`
- Video stream (60 seconds from `timestamp - 60` to `timestamp`)

### `DELETE /api/cleanup-session/:sessionId`

Cleans up all videos for a specific session.

**Response:**
```json
{
  "success": true,
  "cleanedCount": 1
}
```

### `GET /api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🚀 Deployment

### Backend (Render)

1. **Connect your repository to Render**
2. **Create a new Web Service**
3. **Configure:**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
   - **Health Check Path**: `/api/health`

4. **Deploy and note the URL** (e.g., `https://your-app.onrender.com`)

### Frontend (Vercel)

1. **Connect your repository to Vercel**
2. **Configure environment variables:**
   - `BACKEND_URL`: Your Render backend URL
3. **Update `frontend/vercel.json`:**
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-app.onrender.com/api/:path*"
       }
     ]
   }
   ```
4. **Deploy**

## 📝 Environment Variables

### Backend
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment (production/development)

### Frontend
- `BACKEND_URL`: Backend API URL for production

## 🧪 Testing

### Test Video Files

You can test with any video file up to 2GB:
- MP4, AVI, MOV, MKV, etc.
- The application will automatically convert to MP4 for the output clip

### Test Video Links

Use these public Google Drive video links for testing:

1. **Sample Video 1**: [Link to a public test video]
2. **Sample Video 2**: [Link to another public test video]

### Manual Testing

1. **Upload a video file:**
   - Choose a video file from your computer
   - Wait for upload to complete
   - Seek to 60+ seconds
   - Click "Mark Event"
   - Verify 60-second clip downloads

## ⚠️ Known Limitations

- **Upload Size**: Maximum 2GB per video file
- **Session Storage**: Uploaded videos are stored in memory only and lost when server restarts
- **Format**: Currently optimized for MP4 files
- **Duration**: Input videos should be longer than 60 seconds

## 🔍 Troubleshooting

### Common Issues

1. **"File size too large"**
   - Ensure video file is under 2GB
   - Check server memory limits

2. **"Failed to upload video"**
   - Check file format (must be video)
   - Verify server is running and accessible



4. **"Video processing failed"**
   - Check backend logs for FFmpeg errors
   - Verify video format is supported

5. **CORS errors**
   - Ensure backend CORS is configured correctly
   - Check API proxy settings in Vercel

### Debug Mode

Enable debug logging in backend:
```bash
DEBUG=* npm run dev
```

## 📊 Performance

- **Upload Time**: Depends on file size and network speed
- **Processing Time**: ~30-60 seconds for typical videos
- **Memory Usage**: Temporary files cleaned up automatically
- **Session Storage**: Videos stored in memory, cleared on server restart
- **Concurrent Users**: Limited by Render's starter plan and server memory

## 🔒 Security & Privacy

- **No Persistent Storage**: Uploaded videos are never saved to disk
- **Session Isolation**: Each user session is isolated
- **Automatic Cleanup**: Videos are automatically cleaned up when sessions end
- **File Validation**: Only video files are accepted
- **Size Limits**: 2GB maximum file size enforced

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for efficient video labeling workflows** 