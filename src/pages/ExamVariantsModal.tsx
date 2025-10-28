import React from 'react';
import type { Exam } from '../../types';

interface ExamVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
}

const ExamVariantsModal: React.FC<ExamVariantsModalProps> = ({ isOpen, onClose, exam }) => {
  if (!isOpen || !exam) return null;

  // FIX: Use the same "source of truth" as the manager table.
  const isTrulySynced = !!(exam.isSynced && Array.isArray(exam.snapshotVariantIds) && exam.snapshotVariantIds.length > 0);
  const variantIds = exam.snapshotVariantIds || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h4 className="text-xl font-bold text-gray-800">Các biến thể đề thi</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
        </div>
        
        {isTrulySynced ? (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              {/* Updated text to reflect new data model */}
              Đã tạo thành công <strong>{variantIds.length}</strong> biến thể cho bài thi này. Dưới đây là ID của các biến thể trong cơ sở dữ liệu (Firestore collection: `examSnapshots`).
            </p>
            <ul className="space-y-2">
              {variantIds.map((id, index) => (
                <li key={id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-mono text-gray-700 truncate" title={id}>
                    Biến thể {index + 1}: {id}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-amber-50 border-l-4 border-amber-400 text-amber-800 p-4 rounded-r-lg">
             <p>Bài thi này chưa được đồng bộ, vì vậy chưa có biến thể nào được tạo.</p>
          </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
          <button 
            onClick={onClose} 
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamVariantsModal;
