import React, { useEffect, useState } from 'react';
import type { Exam, ExamVariantSnapshot } from '../../types';
// Đảm bảo đường dẫn này đúng với vị trí file service của bạn
import { getExamVariantSnapshots } from '../../services/firebaseExamService';
// Đảm bảo đường dẫn này đúng với vị trí component LoadingSpinner của bạn
import { LoadingSpinner } from '../icons/LoadingSpinner'; 

interface ExamVariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
}

const ExamVariantsModal: React.FC<ExamVariantsModalProps> = ({ isOpen, onClose, exam }) => {
  const [variantDocs, setVariantDocs] = useState<ExamVariantSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Tính toán các giá trị dựa trên props exam để đảm bảo logic nhất quán
  const variantIds = Array.isArray(exam?.snapshotVariantIds) ? exam.snapshotVariantIds : [];
  const totalVariants = typeof exam?.variants === 'number' && exam.variants > 0
    ? exam.variants
    : Math.max(variantIds.length, 1);
  const isTrulySynced = !!(exam?.isSynced && variantIds.length > 0);

  useEffect(() => {
    // Reset trạng thái khi modal đóng hoặc không có exam
    if (!isOpen || !exam) {
      setVariantDocs([]);
      setError('');
      return;
    }

    // Nếu bài thi chưa được đồng bộ (hoặc không có biến thể thực sự), không cần tải
    if (!isTrulySynced) {
      setVariantDocs([]);
      setError('');
      return;
    }

    setIsLoading(true);
    setError(''); // Xóa lỗi cũ

    // Tải các snapshot biến thể từ Firestore
    getExamVariantSnapshots(exam.id)
      .then((docs) => {
        setVariantDocs(docs);
        if (docs.length === 0) {
          setError('Không tìm thấy document biến thể nào trong Firestore.');
        }
      })
      .catch((err) => {
        console.error('Failed to load exam snapshots', err);
        setError('Không thể tải danh sách biến thể. Vui lòng thử lại sau.');
      })
      .finally(() => setIsLoading(false));
  }, [exam, isOpen, isTrulySynced]); // Dependencies để useEffect chạy lại khi các giá trị này thay đổi

  if (!isOpen) return null;

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setError(''); // Xóa lỗi nếu sao chép thành công
    } catch (copyErr) {
      console.error('Failed to copy variant id', copyErr);
      setError('Không thể sao chép ID. Trình duyệt của bạn có thể không hỗ trợ Clipboard API.');
    }
  };

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
            <p className="text-gray-700">
              Các biến thể cho bài thi <strong className="text-indigo-600">{exam.title}</strong> được lưu trong
              collection <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">examSnapshots</code>. Danh sách dưới đây hiển thị ID tài liệu, số câu hỏi và tổng điểm để bạn dễ kiểm tra trong Firestore.
            </p>

            {!isTrulySynced && (
              <p className="text-amber-700 bg-amber-50 p-4 rounded-lg border border-amber-200">
                Bài thi này chưa được đồng bộ, vì vậy chưa có biến thể nào được tạo.
              </p>
            )}

            {isTrulySynced && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                  <span>
                    Đã tạo <strong>{variantIds.length}</strong> / {totalVariants} biến thể.
                  </span>
                  {exam.lastSyncedAt?.seconds && (
                    <span>
                      Đồng bộ lần cuối: {new Date(exam.lastSyncedAt.seconds * 1000).toLocaleString('vi-VN')}
                    </span>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {variantDocs.map((variant, index) => (
                      <li key={variant.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              Biến thể {variant.variant ?? index + 1} {/* Hiển thị số biến thể nếu có, nếu không thì dùng index */}
                            </p>
                            <p className="text-xs text-gray-500 break-all">
                              ID: <span className="font-mono">{variant.id}</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {variant.questions?.length ?? 0} câu hỏi • {variant.totalPoints ?? 0} điểm • thời lượng {variant.duration ?? exam.duration} phút
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyId(variant.id)}
                            className="self-start bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-semibold px-3 py-1 rounded-md transition-colors"
                          >
                            Sao chép ID
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {error && (
              <p className="text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200 text-sm">{error}</p>
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