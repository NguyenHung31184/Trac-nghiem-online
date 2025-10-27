import React, { useRef, useState, useCallback, useEffect } from 'react';
import { CameraIcon } from './icons/CameraIcon';
import { LoadingSpinner } from './icons/LoadingSpinner';

interface ProctoringModalProps {
  reason: string;
  onDone: () => void;
  onPhotoTaken: (photoDataUrl: string) => void;
}

const ProctoringModal: React.FC<ProctoringModalProps> = ({ reason, onDone, onPhotoTaken }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Không thể truy cập máy ảnh. Vui lòng đảm bảo bạn đã cấp quyền và không có ứng dụng nào khác đang sử dụng.");
    }
  }, []);
  
  useEffect(() => {
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  

  const capturePhoto = useCallback(() => {
    setIsCapturing(true);
    setCountdown(3);
    const countdownInterval = setInterval(() => {
        setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    
    setTimeout(() => {
        clearInterval(countdownInterval);
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                // In a real app, you'd upload this to Firebase Storage
                console.log('Photo captured. Size:', Math.round(dataUrl.length / 1024), 'KB');
                onPhotoTaken(dataUrl);
            }
        }
        setIsCapturing(false);
        onDone();
    }, 3000);

  }, [onDone, onPhotoTaken]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Kiểm tra danh tính</h2>
        <p className="text-gray-600 mb-4">{reason}</p>
        
        <div className="bg-gray-900 rounded-lg overflow-hidden aspect-video relative flex items-center justify-center mb-4 border border-gray-700">
            {error ? (
                <p className="text-rose-400 p-4">{error}</p>
            ) : (
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
            )}
            {countdown !== null && countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <span className="text-white text-9xl font-bold">{countdown}</span>
                </div>
            )}
             {!stream && !error && (
                <div className="absolute inset-0 flex items-center justify-center flex-col text-white">
                   <LoadingSpinner />
                   <p className="mt-2">Đang khởi động máy ảnh...</p>
                </div>
            )}
        </div>

        <button
          onClick={capturePhoto}
          disabled={isCapturing || !!error || !stream}
          className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:bg-indigo-400 disabled:cursor-not-allowed flex justify-center items-center"
        >
          {isCapturing ? <LoadingSpinner /> : <><CameraIcon /> <span className="ml-2">Chụp ảnh</span></>}
        </button>
      </div>
    </div>
  );
};

export default ProctoringModal;