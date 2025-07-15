# 🚀 Deployment Guide

This guide will walk you through deploying the Video Labeling Service to Vercel (frontend) and Render (backend).

## 📋 Prerequisites

- GitHub account
- Vercel account (free tier available)
- Render account (free tier available)
- A public Google Drive video for testing

## 🔧 Backend Deployment (Render)

### Step 1: Prepare Repository

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit: Video labeling service"
   git push origin main
   ```

### Step 2: Deploy to Render

1. **Go to [Render Dashboard](https://dashboard.render.com/)**
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the service:**

   **Basic Settings:**
   - **Name**: `video-labeling-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`

   **Build & Deploy:**
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Health Check Path**: `/api/health`

   **Environment Variables:**
   - `NODE_ENV`: `production`

5. **Click "Create Web Service"**
6. **Wait for deployment to complete**
7. **Note your service URL** (e.g., `https://video-labeling-backend.onrender.com`)

### Step 3: Test Backend

1. **Test health endpoint:**
   ```bash
   curl https://your-backend-url.onrender.com/api/health
   ```

2. **Expected response:**
   ```json
   {
     "status": "ok",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "version": "1.0.0",
     "environment": "production"
   }
   ```

## 🎨 Frontend Deployment (Vercel)

### Step 1: Update Configuration

1. **Update `frontend/vercel.json`:**
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-backend-url.onrender.com/api/:path*"
       }
     ]
   }
   ```

2. **Replace `your-backend-url.onrender.com` with your actual Render URL**

### Step 2: Deploy to Vercel

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Click "New Project"**
3. **Import your GitHub repository**
4. **Configure the project:**

   **Framework Preset:**
   - **Framework**: `Next.js`

   **Build & Output Settings:**
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

   **Environment Variables:**
   - `BACKEND_URL`: `https://your-backend-url.onrender.com`

5. **Click "Deploy"**
6. **Wait for deployment to complete**
7. **Note your Vercel URL** (e.g., `https://video-labeling-frontend.vercel.app`)

### Step 3: Test Frontend

1. **Visit your Vercel URL**
2. **Test with a public Google Drive video:**
   - Paste a Google Drive video link
   - Wait for video to load
   - Seek to 60+ seconds
   - Click "Mark Event"
   - Verify 60-second clip downloads

## 🔗 Connect Frontend to Backend

### Option 1: Environment Variables (Recommended)

1. **In Vercel Dashboard:**
   - Go to your project settings
   - Navigate to "Environment Variables"
   - Add: `BACKEND_URL` = `https://your-backend-url.onrender.com`
   - Redeploy

### Option 2: Update vercel.json

1. **Update `frontend/vercel.json` with your actual backend URL**
2. **Redeploy the frontend**

## 🧪 Testing Your Deployment

### Test Video Links

Use these public Google Drive video links for testing:

1. **Sample Test Video**: [Add a public Google Drive video link here]
2. **Alternative Test Video**: [Add another public Google Drive video link here]

### Test Flow

1. **Open your Vercel frontend URL**
2. **Paste a Google Drive video link**
3. **Wait for video to load and play**
4. **Seek to 60+ seconds**
5. **Click "Mark Event"**
6. **Verify 60-second clip downloads automatically**

### Expected Behavior

- ✅ Video loads and plays in browser
- ✅ "Mark Event" button enables after 60 seconds
- ✅ Clicking "Mark Event" triggers download
- ✅ Downloaded file is 60 seconds long
- ✅ File ends at the timestamp when clicked

## 🔍 Troubleshooting

### Common Issues

1. **"Failed to download video"**
   - Check if Google Drive link is public
   - Verify direct download URL format
   - Check Render logs for download errors

2. **"Video processing failed"**
   - Check Render logs for FFmpeg errors
   - Verify video format is supported (MP4 recommended)
   - Check if video is too large (>500MB)

3. **CORS errors**
   - Verify backend CORS configuration
   - Check API proxy settings in Vercel
   - Ensure frontend and backend URLs are correct

4. **"Endpoint not found"**
   - Verify API routes are working
   - Check if backend is running
   - Test health endpoint directly

### Debug Steps

1. **Check Render logs:**
   - Go to Render dashboard
   - Click on your service
   - View "Logs" tab

2. **Check Vercel logs:**
   - Go to Vercel dashboard
   - Click on your project
   - View "Functions" tab

3. **Test backend directly:**
   ```bash
   curl -X POST https://your-backend-url.onrender.com/api/snip \
     -H "Content-Type: application/json" \
     -d '{"video_url":"YOUR_VIDEO_URL","timestamp":120}'
   ```

## 📊 Monitoring

### Render Monitoring

- **Uptime**: Check service status in Render dashboard
- **Logs**: Monitor application logs for errors
- **Performance**: Watch for timeout issues

### Vercel Monitoring

- **Analytics**: View page views and performance
- **Functions**: Monitor API route performance
- **Errors**: Check for client-side errors

## 🔄 Updates and Maintenance

### Updating Backend

1. **Push changes to GitHub**
2. **Render will auto-deploy**
3. **Monitor logs for any issues**

### Updating Frontend

1. **Push changes to GitHub**
2. **Vercel will auto-deploy**
3. **Test the updated functionality**

### Environment Variables

- **Backend**: Update in Render dashboard
- **Frontend**: Update in Vercel dashboard
- **Remember to redeploy after changes**

## 🎉 Success!

Your Video Labeling Service is now deployed and ready to use! Users can:

1. Visit your Vercel URL
2. Paste Google Drive video links
3. Watch videos and mark events
4. Download 60-second clips automatically

The service is lightweight, scalable, and requires no persistent storage - perfect for efficient video labeling workflows! 