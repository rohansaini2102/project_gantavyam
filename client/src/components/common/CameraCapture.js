import React, { useState, useRef, useCallback } from 'react';
import { FiCamera, FiX, FiRefreshCw, FiCheck } from 'react-icons/fi';

const CameraCapture = ({ onCapture, label = "Live Photo", required = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsCameraReady(true);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera and try again.');
      } else {
        setError('Unable to access camera. Please try again.');
      }
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraReady(false);
    }
  }, [stream]);

  const openCamera = () => {
    setIsOpen(true);
    startCamera();
  };

  const closeCamera = () => {
    stopCamera();
    setIsOpen(false);
    setCapturedImage(null);
    setError(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'driver-selfie.jpg', { type: 'image/jpeg' });
          setCapturedImage(URL.createObjectURL(blob));
          onCapture(file);
          stopCamera();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmPhoto = () => {
    closeCamera();
  };

  return (
    <div className="space-y-2">
      <label className="block text-gray-700 font-medium mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {!isOpen && (
        <div className="space-y-2">
          {capturedImage && (
            <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200">
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            <FiCamera />
            {capturedImage ? 'Retake Photo' : 'Take Photo'}
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Capture Live Photo</h3>
              <button
                type="button"
                onClick={closeCamera}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX size={24} />
              </button>
            </div>

            {error ? (
              <div className="text-red-500 text-center py-8">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {!capturedImage ? (
                  <>
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        onLoadedMetadata={() => setIsCameraReady(true)}
                      />
                      {!isCameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-white">Loading camera...</div>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        disabled={!isCameraReady}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <FiCamera size={20} />
                        Capture Photo
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                      <img
                        src={capturedImage}
                        alt="Captured"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex justify-center gap-4">
                      <button
                        type="button"
                        onClick={retakePhoto}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
                      >
                        <FiRefreshCw />
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={confirmPhoto}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                      >
                        <FiCheck />
                        Use This Photo
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraCapture;