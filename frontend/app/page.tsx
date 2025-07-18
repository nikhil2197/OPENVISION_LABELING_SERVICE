'use client';

import { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';

interface UploadedVideo {
  videoId: string;
  sessionId: string;
  originalName: string;
  size: number;
}

export default function Home() {
  const [directVideoUrl, setDirectVideoUrl] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'getting-url' | 'uploading' | 'getting-download-url'>('idle');
  const [currentUploadFile, setCurrentUploadFile] = useState<{name: string, size: number, sizeFormatted: string} | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const playerRef = useRef<ReactPlayer>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadXHRRef = useRef<XMLHttpRequest | null>(null);

  // Cleanup session on component unmount
  // Cleanup session on component unmount (clears any server-side session videos if used)
  useEffect(() => {
    return () => {
      fetch(`/api/cleanup-session/${sessionId}`, { method: 'DELETE' }).catch(console.error);
    };
  }, [sessionId]);

  // Reset loading state when video URL changes
  useEffect(() => {
    setIsVideoLoading(false);
  }, [directVideoUrl]);

  // Handle file upload via GCS signed URLs with progress tracking
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (2GB limit)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setError('File size must be less than 2GB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStage('getting-url');
    setError('');
    setUploadedVideo(null);
    setDirectVideoUrl('');
    setCurrentUploadFile({
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size)
    });

    try {
      // 1) Request signed PUT URL
      const uploadRes = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!uploadRes.ok) throw new Error('Failed to get upload URL');
      const { uploadUrl } = await uploadRes.json();

      // 2) Upload to GCS with progress tracking
      setUploadStage('uploading');
      setUploadProgress(0);
      
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadXHRRef.current = xhr;
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was aborted'));
        });

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Record uploaded video info
      const uploaded: UploadedVideo = {
        videoId: file.name,
        sessionId,
        originalName: file.name,
        size: file.size,
      };
      setUploadedVideo(uploaded);

      // 3) Request signed GET URL
      setUploadStage('getting-download-url');
      setUploadProgress(95); // Almost done
      
      const downloadRes = await fetch(`/api/download-url?filename=${encodeURIComponent(file.name)}`);
      if (!downloadRes.ok) throw new Error('Failed to get download URL');
      const { downloadUrl } = await downloadRes.json();
      setDirectVideoUrl(downloadUrl);
      
      setUploadProgress(100);
      // Reset progress after a short delay
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStage('idle');
        setCurrentUploadFile(null);
      }, 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      setCurrentUploadFile(null);
      uploadXHRRef.current = null;
    }
  };



  const handleProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds);
  };

  const handleDuration = (duration: number) => {
    setDuration(duration);
  };

  const handleVideoReady = () => {
    setIsVideoLoading(false);
    setError('');
    console.log('Video loaded successfully');
  };

  const handleVideoError = (error: any) => {
    setIsVideoLoading(false);
    console.error('Video loading error:', error);
    setError('Failed to load video. Please check if the Google Drive link is public and accessible.');
  };

  const handleVideoStart = () => {
    setIsVideoLoading(true);
    
    // Add a timeout to ensure loading state doesn't get stuck
    setTimeout(() => {
      setIsVideoLoading(false);
      console.log('Video loading timeout - forcing loading state to false');
    }, 10000); // 10 second timeout
  };

  const handleVideoLoad = () => {
    setIsVideoLoading(false);
    console.log('Video load event triggered');
  };

  const handleVideoCanPlay = () => {
    setIsVideoLoading(false);
    console.log('Video can play event triggered');
  };

  const handleMarkEvent = async () => {
    if (currentTime < 60) {
      setError('Video must be at least 60 seconds in to mark an event');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const requestBody: any = {
        timestamp: currentTime,
      };

      // Add video source - only uploaded videos supported
      if (uploadedVideo) {
        requestBody.video_id = uploadedVideo.videoId;
      } else {
        throw new Error('No video uploaded');
      }

      console.log('Sending request to /api/snip with body:', requestBody);

      const response = await fetch('/api/snip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename
      let filename = 'clip';
      if (uploadedVideo) {
        const nameWithoutExt = uploadedVideo.originalName.replace(/\.[^/.]+$/, '');
        filename = `${nameWithoutExt}_${Math.floor(currentTime)}s.mp4`;
      } else {
        filename = `clip_${Math.floor(currentTime)}s.mp4`;
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error in handleMarkEvent:', err);
      setError(err instanceof Error ? err.message : 'Failed to create video clip');
    } finally {
      setIsProcessing(false);
    }
  };

  const canMarkEvent = currentTime >= 60 && directVideoUrl && !isProcessing;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getUploadStageMessage = (stage: string, progress: number): string => {
    switch (stage) {
      case 'getting-url':
        return 'Getting upload URL...';
      case 'uploading':
        if (progress === 0) return 'Starting upload...';
        if (progress < 10) return 'Uploading to cloud storage...';
        if (progress < 50) return 'Uploading video data...';
        if (progress < 90) return 'Almost done uploading...';
        return 'Finalizing upload...';
      case 'getting-download-url':
        return 'Preparing video for playback...';
      default:
        return 'Processing...';
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎬 Video Labeling Service
          </h1>
          <p className="text-lg text-gray-600">
            Create 60-second video clips from uploaded videos
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">


          {/* Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Video File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : 'Choose Video File'}
              </button>
              <p className="mt-2 text-sm text-gray-500">
                Maximum file size: 2GB. Supported formats: MP4, AVI, MOV, etc.
              </p>
              
              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="mt-4">
                  {currentUploadFile && (
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="text-sm font-medium text-blue-800">{currentUploadFile.name}</div>
                      <div className="text-xs text-blue-600">{currentUploadFile.sizeFormatted}</div>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {getUploadStageMessage(uploadStage, uploadProgress)}
                    </span>
                    <span className="text-sm text-gray-500">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  {uploadStage === 'uploading' && uploadProgress > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 mb-2">
                        Large video files may take several minutes to upload. Please don't close this page.
                      </p>
                      <button
                        onClick={() => {
                          if (uploadXHRRef.current) {
                            uploadXHRRef.current.abort();
                          }
                        }}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Cancel upload
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              {uploadedVideo && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-green-800">{uploadedVideo.originalName}</div>
                      <div className="text-sm text-green-600">{formatFileSize(uploadedVideo.size)}</div>
                    </div>
                    <div className="text-green-600">✓ Uploaded</div>
                  </div>
                </div>
              )}
            </div>
          </div>





          {/* Video Player */}
          {directVideoUrl && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Player
                {uploadedVideo && ` - ${uploadedVideo.originalName}`}
              </label>
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                {isVideoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <div className="text-white text-lg mb-2">Loading video...</div>
                      <button
                        onClick={() => setIsVideoLoading(false)}
                        className="text-white text-sm underline hover:no-underline"
                      >
                        Click to dismiss
                      </button>
                    </div>
                  </div>
                )}
                <ReactPlayer
                  ref={playerRef}
                  url={directVideoUrl}
                  width="100%"
                  height="100%"
                  controls
                  onProgress={handleProgress}
                  onDuration={handleDuration}
                  onReady={handleVideoReady}
                  onError={handleVideoError}
                  onStart={handleVideoStart}
                  onLoad={handleVideoLoad}
                  onCanPlay={handleVideoCanPlay}
                  config={{
                    file: {
                      attributes: {
                        crossOrigin: "anonymous"
                      },
                      forceVideo: true
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Video Info */}
          {directVideoUrl && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Current Time:</span>
                <span className="text-sm text-gray-600">
                  {Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(1).padStart(4, '0')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Duration:</span>
                <span className="text-sm text-gray-600">
                  {Math.floor(duration / 60)}:{(duration % 60).toFixed(1).padStart(4, '0')}
                </span>
              </div>
            </div>
          )}

          {/* Mark Event Button */}
          <button
            onClick={handleMarkEvent}
            disabled={!canMarkEvent}
            className={`w-full py-3 px-6 rounded-md font-medium transition-colors ${
              canMarkEvent
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Mark Event'}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How it works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Select a video file from your computer (up to 2GB)</li>
            <li>Watch the video in the player above</li>
            <li>Click "Mark Event" when you reach the desired moment</li>
            <li>Receive a 60-second clip ending at that timestamp</li>
            <li>Uploaded videos are stored in session memory only - no persistent storage!</li>
          </ol>
        </div>
      </div>
    </main>
  );
} 