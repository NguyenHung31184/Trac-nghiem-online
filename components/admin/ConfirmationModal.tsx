import React from 'react';
import { ExclamationTriangleIcon } from '../icons/ExclamationTriangleIcon';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-md w-full">
        <div className="flex items-start space-x-4">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 sm:mx-0 sm:h-10 sm:w-10">
                <ExclamationTriangleIcon className="h-6 w-6 text-rose-600" />
            </div>
            <div className="flex-1">
                 <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                 <div className="mt-2 text-sm text-gray-600">
                    {message}
                 </div>
            </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 font-bold py-2 px-4 rounded-lg transition-colors text-sm">Hủy</button>
            <button 
                type="button" 
                onClick={() => {
                    onConfirm();
                    onClose();
                }} 
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors shadow-sm text-sm"
            >
                Xác nhận
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
