import React, { useMemo } from 'react';
import type { Exam } from '../../types';

interface ExamVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
}

const ExamVariantsModal: React.FC<ExamVariantsModalProps> = ({ isOpen, onClose, exam }) => {
  const NUM_VARIANTS = 10; // As defined in the backend

  const variantUrls = useMemo(() => {
    const snapshotUrl = exam.questionsSnapshotUrl;
    if (!snapshotUrl) {
      return [];
    }
    
    // Replace the specific variant part of the URL with a placeholder
    const baseUrl = snapshotUrl.replace(/_variant-\d{2}_snapshot\.json$/, '');
    
    const urls: string[] = [];
    for (let i = 1; i <= NUM_VARIANTS; i++) {
      const variantNumber = String(i).padStart(2, '0');
      urls.push(`${baseUrl}_variant-${variantNumber}_snapshot.json`);
    }
    return urls;
  }, [exam.questionsSnapshotUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Các biến thể đề thi
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors">&times;</button>
        </div>
        
        <div className="space-y-4">
            <p className="text-gray-700">Đây là các liên kết trực tiếp đến {NUM_VARIANTS} file câu hỏi (biến thể) đã được tạo cho bài thi <strong className="text-indigo-600">{exam.title}</strong>. Bạn có thể mở chúng để kiểm tra nội dung.</p>
            {variantUrls.length > 0 ? (
                <ul className="space-y-2 list-disc list-inside bg-gray-50 p-4 rounded-lg border">
                    {variantUrls.map((url, index) => (
                        <li key={index} className="text-sm">
                            <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-mono text-indigo-700 hover:text-indigo-900 hover:underline break-all"
                            >
                                Biến thể {index + 1}
                            </a>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-amber-700 bg-amber-50 p-4 rounded-lg border border-amber-200">Bài thi này chưa được đồng bộ, vì vậy chưa có biến thể nào được tạo.</p>
            )}
        </div>

        <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 font-bold py-2 px-4 rounded-lg transition-colors text-sm">Đóng</button>
        </div>
      </div>
    </div>
  );
};

export default ExamVariantsModal;
