import React, { useCallback, useEffect, useState } from 'react';

// Icons
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ExclamationCircleIcon } from '../icons/ExclamationCircleIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { ViewListIcon } from '../icons/ViewListIcon';

// Modals
import ExamFormModal from './ExamFormModal';
import ExamVariantsModal from './ExamVariantsModal';

// Types
import type { Exam } from '../../types';

// UI Components
import LoadingSpinner from '../ui/LoadingSpinner';

// Services
import {
  deleteExamWithVariants,
  generateExamVariants,
  getExams,
} from '../../services/firebaseExamService';

// ===========================================================================================
// Định nghĩa Types
// ===========================================================================================

type SyncStatus = 'success' | 'error';

interface SyncResult {
  status: SyncStatus;
  message: string;
}

// ===========================================================================================
// Component chính: ExamManager
// ===========================================================================================

const ExamManager: React.FC = () => {
  // ===========================================================================================
  // Quản lý State
  // ===========================================================================================
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [globalError, setGlobalError] = useState(''); // Lỗi chung cho cả trang
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  const [selectedExamForVariants, setSelectedExamForVariants] = useState<Exam | null>(null);
  const [syncingExamId, setSyncingExamId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult>>({}); // Kết quả đồng bộ cho từng bài thi

  // ===========================================================================================
  // Tải danh sách bài thi
  // ===========================================================================================
  const loadExams = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setGlobalError(''); // Xóa lỗi cũ khi tải lại

    try {
      const data = await getExams();
      setExams(data);
    } catch (err) {
      console.error('Lỗi khi tải danh sách bài thi:', err);
      setGlobalError('Không thể tải danh sách bài thi. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []); // Dependency rỗng vì không phụ thuộc vào props hay state bên ngoài

  // Tải bài thi khi component mount
  useEffect(() => {
    loadExams();
  }, [loadExams]);

  // ===========================================================================================
  // Xử lý các hành động trên Modal
  // ===========================================================================================

  const resetModals = useCallback(() => {
    setIsFormModalOpen(false);
    setIsVariantsModalOpen(false);
    setEditingExam(null);
    setSelectedExamForVariants(null);
  }, []);

  const handleModalSave = useCallback(async () => {
    resetModals();
    await loadExams(); // Tải lại danh sách sau khi lưu hoặc cập nhật
  }, [resetModals, loadExams]);

  const handleModalClose = useCallback(() => {
    resetModals();
  }, [resetModals]);

  // ===========================================================================================
  // Xử lý sự kiện từ UI
  // ===========================================================================================

  const handleAddNewExam = useCallback(() => {
    setEditingExam(null); // Đảm bảo không có bài thi nào đang được chỉnh sửa
    setIsFormModalOpen(true);
  }, []);

  const handleEditExam = useCallback((exam: Exam) => {
    setEditingExam(exam);
    setIsFormModalOpen(true);
  }, []);

  const handleDeleteExam = useCallback(
    async (id: string) => {
      if (!window.confirm('Bạn có chắc chắn muốn xóa bài thi này và tất cả các biến thể của nó?')) {
        return;
      }

      setGlobalError(''); // Xóa lỗi chung trước khi thực hiện hành động mới
      try {
        await deleteExamWithVariants(id);
        setExams((prev) => prev.filter((exam) => exam.id !== id));
        // Xóa kết quả đồng bộ nếu có
        setSyncResults((prev) => {
          const { [id]: _removed, ...rest } = prev;
          return rest;
        });
      } catch (err) {
        console.error('Lỗi khi xóa bài thi:', err);
        const message =
          err instanceof Error
            ? `Không thể xóa bài thi: ${err.message}`
            : 'Đã xảy ra lỗi không mong muốn khi xóa bài thi.';
        setGlobalError(message);
      }
    },
    [],
  );

  const handleSyncExam = useCallback(
    async (examId: string) => {
      setSyncingExamId(examId);
      // Xóa kết quả đồng bộ cũ cho bài thi này
      setSyncResults((prev) => {
        const { [examId]: _removed, ...rest } = prev;
        return rest;
      });

      try {
        const result = await generateExamVariants(examId);

        if (result.success) {
          setSyncResults((prev) => ({
            ...prev,
            [examId]: {
              status: 'success',
              message: result.message || 'Đã đồng bộ thành công các biến thể.',
            },
          }));
          await loadExams(false); // Tải lại danh sách bài thi mà không hiển thị spinner toàn trang
        } else {
          setSyncResults((prev) => ({
            ...prev,
            [examId]: {
              status: 'error',
              message: result.message || 'Không thể đồng bộ bài thi. Vui lòng kiểm tra dữ liệu.',
            },
          }));
          // Cập nhật trạng thái isSynced nếu đồng bộ thất bại
          setExams((prevExams) =>
            prevExams.map((exam) =>
              exam.id === examId
                ? { ...exam, isSynced: false, snapshotVariantIds: [] } // Reset trạng thái đồng bộ
                : exam,
            ),
          );
        }
      } catch (err) {
        console.error('Lỗi khi đồng bộ bài thi:', err);
        setSyncResults((prev) => ({
          ...prev,
          [examId]: {
            status: 'error',
            message: err instanceof Error ? err.message : 'Đã xảy ra lỗi không mong muốn.',
          },
        }));
        // Cập nhật trạng thái isSynced nếu có lỗi
        setExams((prevExams) =>
          prevExams.map((exam) =>
            exam.id === examId
              ? { ...exam, isSynced: false, snapshotVariantIds: [] }
              : exam,
          ),
        );
      } finally {
        setSyncingExamId(null);
      }
    },
    [loadExams],
  );

  const handleViewExamVariants = useCallback((exam: Exam) => {
    setSelectedExamForVariants(exam);
    setIsVariantsModalOpen(true);
  }, []);

  // ===========================================================================================
  // Render UI
  // ===========================================================================================

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900">Quản lý Bài thi</h1>
        <button
          onClick={handleAddNewExam}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg flex items-center shadow-md transition-all duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
        >
          <PlusCircleIcon className="w-5 h-5 mr-2" />
          <span>Tạo bài thi mới</span>
        </button>
      </div>

      {/* Global Error Display */}
      {globalError && (
        <div
          className="mb-6 bg-rose-100 border border-rose-400 text-rose-700 px-4 py-3 rounded-md shadow-sm"
          role="alert"
        >
          <strong className="font-bold">Lỗi:</strong>
          <span className="block sm:inline ml-2">{globalError}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600">
            <LoadingSpinner className="w-10 h-10 text-indigo-600" />
            <p className="mt-4 text-lg">Đang tải danh sách bài thi...</p>
          </div>
        ) : exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <ExclamationCircleIcon className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium">Chưa có bài thi nào.</p>
            <p className="mt-2 text-md">Hãy nhấn "Tạo bài thi mới" để bắt đầu!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Trạng thái đồng bộ
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Tiêu đề Bài thi
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Số biến thể
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exams.map((exam) => {
                  const variantIds = Array.isArray(exam.snapshotVariantIds)
                    ? exam.snapshotVariantIds
                    : [];
                  const syncedCount = variantIds.length;
                  // Nếu exam.variants không được định nghĩa hoặc < 1, mặc định là 1 hoặc số biến thể đã đồng bộ
                  const totalExpectedVariants =
                    typeof exam.variants === 'number' && exam.variants > 0
                      ? exam.variants
                      : Math.max(syncedCount, 1); // Đảm bảo không hiển thị 0/0 nếu đã có biến thể
                  const isTrulySynced = Boolean(exam.isSynced && syncedCount > 0);

                  return (
                    <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isTrulySynced ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircleIcon className="w-4 h-4 mr-1" />
                            Đã đồng bộ
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                            <ExclamationCircleIcon className="w-4 h-4 mr-1" />
                            Chưa đồng bộ
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{exam.title}</div>
                        <div className="text-xs text-gray-500 mt-1">ID: {exam.id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {isTrulySynced
                          ? `${syncedCount} / ${totalExpectedVariants}`
                          : `0 / ${totalExpectedVariants}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleSyncExam(exam.id)}
                            disabled={syncingExamId === exam.id}
                            className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            title="Đồng bộ (tạo / cập nhật) các biến thể đề thi"
                          >
                            {syncingExamId === exam.id ? (
                              <LoadingSpinner className="w-5 h-5 text-sky-600" />
                            ) : (
                              <RefreshIcon className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEditExam(exam)}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors duration-200"
                            title="Sửa bài thi"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExam(exam.id)}
                            className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors duration-200"
                            title="Xóa bài thi và các biến thể"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                          {isTrulySynced && (
                            <button
                              onClick={() => handleViewExamVariants(exam)}
                              className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors duration-200"
                              title="Xem các biến thể đề thi đã tạo"
                            >
                              <ViewListIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync Results Display */}
      {Object.keys(syncResults).length > 0 && (
        <div className="mt-6 space-y-3">
          {Object.entries(syncResults).map(([examId, result]) => (
            <div
              key={examId}
              className={`p-4 rounded-md text-sm shadow-sm ${result.status === 'success'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              role="status"
            >
              <strong className="font-semibold">
                Bài thi {exams.find((exam) => exam.id === examId)?.title || examId}:
              </strong>{' '}
              {result.message}
            </div>
          ))}
        </div>
      )}

      {/* Exam Form Modal */}
      {isFormModalOpen && (
        <ExamFormModal
          isOpen={isFormModalOpen}
          onClose={handleModalClose}
          onSave={handleModalSave}
          initialExam={editingExam}
        />
      )}

      {/* Exam Variants Modal */}
      {isVariantsModalOpen && selectedExamForVariants && (
        <ExamVariantsModal
          isOpen={isVariantsModalOpen}
          onClose={handleModalClose}
          exam={selectedExamForVariants}
        />
      )}
    </div>
  );
};

export default ExamManager;