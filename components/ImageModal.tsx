import React from 'react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity"
      onClick={onClose}
    >
      <div 
        className="bg-white p-4 rounded-xl shadow-2xl max-w-4xl max-h-[90vh] w-auto relative"
        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking on the image container
      >
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 text-gray-600 bg-white/70 hover:bg-white rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          aria-label="Đóng"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img 
          src={imageUrl} 
          alt="Hình ảnh xem trước" 
          className="max-w-full max-h-[85vh] object-contain rounded-lg" 
        />
      </div>
    </div>
  );
};

export default ImageModal;
