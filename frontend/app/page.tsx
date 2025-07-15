'use client';

import { useState, useRef } from 'react';
import ReactPlayer from 'react-player';

interface DriveFile {
  id: string;
  name: string;
  size: string;
  mimeType: string;
}

export default function Home() {
  const [videoUrl, setVideoUrl] = useState('');
  const [directVideoUrl, setDirectVideoUrl] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isLoadingFolder, setIsLoadingFolder] = useState(false);
  const [folderFiles, setFolderFiles] = useState<DriveFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const playerRef = useRef<ReactPlayer>(null);

  // Convert Google Drive shared link to direct download link
  const convertToDirectUrl = (fileId: string): string => {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  };

  // Extract folder ID from Google Drive folder URL
  const extractFolderId = (url: string): string | null => {
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    return folderMatch ? folderMatch[1] : null;
  };

  // Load files from Google Drive folder
  const loadFolderFiles = async (folderUrl: string) => {
    setIsLoadingFolder(true);
    setError('');
    setFolderFiles([]);
    setSelectedFile(null);
    setDirectVideoUrl('');

    try {
      const folderId = extractFolderId(folderUrl);
      if (!folderId) {
        throw new Error('Invalid Google Drive folder URL');
      }

      console.log('Loading folder:', folderId);
      
      // Call the backend API to get folder contents
      const response = await fetch(`/api/folder/${folderId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setFolderFiles(data.files || []);
      
    } catch (err) {
      setError('Failed to load folder. Please check the URL and try again.');
      console.error('Folder loading error:', err);
    } finally {
      setIsLoadingFolder(false);
    }
  };

  const handleVideoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setVideoUrl(url);
    setError('');
    setIsVideoLoading(false);
    setFolderFiles([]);
    setSelectedFile(null);
    setDirectVideoUrl('');
    
    if (url.includes('drive.google.com')) {
      if (url.includes('/folders/')) {
        // It's a folder link
        loadFolderFiles(url);
      } else {
        // It's a direct file link
        const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
        if (fileMatch) {
          const directUrl = convertToDirectUrl(fileMatch[1]);
          console.log('Original URL:', url);
          console.log('Converted URL:', directUrl);
          setDirectVideoUrl(directUrl);
        }
      }
    } else {
      setDirectVideoUrl(url);
    }
  };

  const handleFileSelect = (file: DriveFile) => {
    setSelectedFile(file);
    const directUrl = convertToDirectUrl(file.id);
    setDirectVideoUrl(directUrl);
    setError('');
    setIsVideoLoading(false);
    console.log('Selected file:', file.name);
    console.log('Direct URL:', directUrl);
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
  };

  const handleMarkEvent = async () => {
    if (currentTime < 60) {
      setError('Video must be at least 60 seconds in to mark an event');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch('/api/snip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          video_url: directVideoUrl,
          timestamp: currentTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clip_${selectedFile?.name || 'video'}_${Math.floor(currentTime)}s.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create video clip');
    } finally {
      setIsProcessing(false);
    }
  };

  const canMarkEvent = currentTime >= 60 && directVideoUrl && !isProcessing;

  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎬 Video Labeling Service
          </h1>
          <p className="text-lg text-gray-600">
            Create 60-second video clips from Google Drive videos
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4">
            <label htmlFor="videoUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Google Drive Link (File or Folder)
            </label>
            <input
              id="videoUrl"
              type="url"
              value={videoUrl}
              onChange={handleVideoUrlChange}
              placeholder="https://drive.google.com/drive/folders/FOLDER_ID or https://drive.google.com/file/d/FILE_ID/view"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-sm text-gray-500">
              Paste a Google Drive folder link to browse videos, or a direct file link
            </p>
          </div>

          {/* Folder Files List */}
          {isLoadingFolder && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-blue-600">Loading folder contents...</span>
              </div>
            </div>
          )}

          {folderFiles.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Video File
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {folderFiles
                  .filter(file => file.mimeType.startsWith('video/'))
                  .map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleFileSelect(file)}
                      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedFile?.id === file.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{file.name}</div>
                          <div className="text-sm text-gray-500">{file.size}</div>
                        </div>
                        {selectedFile?.id === file.id && (
                          <div className="text-blue-600">✓ Selected</div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              {folderFiles.filter(file => file.mimeType.startsWith('video/')).length === 0 && (
                <p className="text-gray-500 text-sm">No video files found in this folder.</p>
              )}
            </div>
          )}

          {directVideoUrl && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video Player {selectedFile && `- ${selectedFile.name}`}
              </label>
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                {isVideoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                    <div className="text-white text-lg">Loading video...</div>
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
            <li>Paste a Google Drive folder link or direct video file link</li>
            <li>If it's a folder, select the video file you want to view</li>
            <li>Watch the video in the player above</li>
            <li>Click "Mark Event" when you reach the desired moment</li>
            <li>Receive a 60-second clip ending at that timestamp</li>
            <li>The clip downloads automatically - no storage required!</li>
          </ol>
        </div>
      </div>
    </main>
  );
} 