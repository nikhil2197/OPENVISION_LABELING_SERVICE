# 🎬 Video Labeling Service

A lightweight tool for creating 60-second video clips from Google Drive videos. Users can watch a video, click "Mark Event" at any moment, and receive a downloadable clip ending at that timestamp.

## 🏗️ Architecture

- **Frontend**: Next.js (deployed on Vercel)
- **Backend**: Node.js + Express (deployed on Render)
- **Video Processing**: FFmpeg for clipping and streaming
- **Storage**: None - clips are streamed directly, no persistent storage

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
   - Paste a Google Drive video link
   - Watch the video and click "Mark Event"
   - Download your 60-second clip!

## 🎯 How It Works

1. **Input**: User provides a Google Drive video link
2. **Conversion**: App converts shared links to direct download URLs
3. **Playback**: Video plays in browser using ReactPlayer
4. **Event Marking**: User clicks "Mark Event" at desired timestamp
5. **Processing**: Backend downloads video, clips 60s ending at timestamp
6. **Delivery**: 60-second clip streams directly to user's browser

## 🔧 API Endpoints

### `POST /api/snip`

Creates a 60-second video clip ending at the specified timestamp.

**Request:**
```json
{
  "video_url": "https://drive.google.com/uc?export=download&id=FILE_ID",
  "timestamp": 132.4
}
```

**Response:**
- `Content-Type: video/mp4`
- `Content-Disposition: attachment; filename="clip_132s.mp4"`
- Video stream (60 seconds from `timestamp - 60` to `timestamp`)

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

### Test Video Links

Use these public Google Drive video links for testing:

1. **Sample Video 1**: [Link to a public test video]
2. **Sample Video 2**: [Link to another public test video]

### Manual Testing

1. Paste a Google Drive video link
2. Wait for video to load
3. Seek to 60+ seconds
4. Click "Mark Event"
5. Verify 60-second clip downloads

## ⚠️ Known Limitations

- **Google Drive**: Videos must be public and direct-downloadable
- **Video Size**: Large videos may timeout during download
- **Format**: Currently optimized for MP4 files
- **Duration**: Input videos should be longer than 60 seconds

## 🔍 Troubleshooting

### Common Issues

1. **"Failed to download video"**
   - Check if Google Drive link is public
   - Verify direct download URL format

2. **"Video processing failed"**
   - Check backend logs for FFmpeg errors
   - Verify video format is supported

3. **CORS errors**
   - Ensure backend CORS is configured correctly
   - Check API proxy settings in Vercel

### Debug Mode

Enable debug logging in backend:
```bash
DEBUG=* npm run dev
```

## 📊 Performance

- **Processing Time**: ~30-60 seconds for typical videos
- **Memory Usage**: Temporary files cleaned up automatically
- **Concurrent Users**: Limited by Render's starter plan

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