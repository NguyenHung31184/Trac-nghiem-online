import React from 'react';
import { ExclamationCircleIcon } from './icons/ExclamationCircleIcon';

interface ViolationWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  violationCount: number;
  maxViolations: number;
}

const ViolationWarningModal: React.FC<ViolationWarningModalProps> = ({
  isOpen,
  onClose,
  violationCount,
  maxViolations,
}) => {
  if (!isOpen) return null;

  const isFinalWarning = violationCount >= maxViolations;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100">
            <ExclamationCircleIcon className="h-8 w-8 text-rose-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mt-4 mb-2">Cảnh báo vi phạm</h2>
        <p className="text-gray-600 mb-4">
            {isFinalWarning
                ? 'Bạn đã vượt quá số lần cho phép rời khỏi màn hình thi. Bài thi sẽ được nộp tự động.'
                : 'Hệ thống đã phát hiện bạn rời khỏi màn hình thi. Vui lòng tập trung vào bài làm để tránh bị hủy kết quả.'}
        </p>

        <div className="bg-gray-100 p-3 rounded-lg mb-6">
            <p className="font-semibold text-gray-800">
                Số lần vi phạm: <span className="text-rose-600 font-bold text-lg">{violationCount} / {maxViolations}</span>
            </p>
        </div>

        {!isFinalWarning && (
            <button
              onClick={onClose}
              className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              Tôi đã hiểu, quay lại bài thi
            </button>
        )}
      </div>
    </div>
  );
};

export default ViolationWarningModal;
