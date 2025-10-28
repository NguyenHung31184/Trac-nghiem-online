import React, { useState, useEffect } from 'react';
import { PlusCircleIcon, PencilIcon, TrashIcon, CheckCircleIcon, ExclamationCircleIcon, RefreshIcon, ViewListIcon } from '@heroicons/react/solid';
import ExamFormModal from './ExamFormModal';
import ExamVariantsModal from './ExamVariantsModal'; // Đảm bảo đã import
import { Exam } from '../../types/exam'; // Đảm bảo đường dẫn đúng đến kiểu Exam của bạn
import LoadingSpinner from '../ui/LoadingSpinner'; // Giả định bạn có một component LoadingSpinner

// Giả định các hàm API của bạn
const fetchExamsApi = async (): Promise<Exam[]> => {
    // Đây là dữ liệu giả định, bạn cần thay thế bằng lệnh gọi API thực tế
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                { id: 'exam1', title: 'Bài thi Toán 10', variants: 5, isSynced: true, snapshotVariantIds: ['v1', 'v2', 'v3'] },
                { id: 'exam2', title: 'Bài thi Lý 11', variants: 3, isSynced: false, snapshotVariantIds: [] },
                { id: 'exam3', title: 'Bài thi Hóa 12', variants: 2, isSynced: true, snapshotVariantIds: ['v4', 'v5'] },
                { id: 'exam4', title: 'Bài thi Anh Văn', variants: 0, isSynced: false, snapshotVariantIds: [] }, // Exam with 0 variants
                { id: 'exam5', title: 'Bài thi Sinh Học', variants: 4, isSynced: false, snapshotVariantIds: [] },
            ]);
        }, 500);
    });
};

const createExamApi = async (exam: Omit<Exam, 'id' | 'isSynced' | 'snapshotVariantIds'>): Promise<Exam> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const newExam = { ...exam, id: `exam${Math.random().toString(36).substr(2, 9)}`, isSynced: false, snapshotVariantIds: [] };
            resolve(newExam);
        }, 500);
    });
};

const updateExamApi = async (exam: Exam): Promise<Exam> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(exam);
        }, 500);
    });
};

const deleteExamApi = async (id: string): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 300);
    });
};

const syncExamApi = async (examId: string): Promise<{ status: 'success' | 'error'; message: string; snapshotVariantIds?: string[] }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            if (Math.random() > 0.2) { // Giả định 80% thành công
                const numVariants = Math.floor(Math.random() * 5) + 1; // 1-5 variants
                const snapshotVariantIds = Array.from({ length: numVariants }, (_, i) => `v${examId}_${i + 1}`);
                resolve({ status: 'success', message: `Đã đồng bộ thành công ${numVariants} biến thể.`, snapshotVariantIds });
            } else {
                resolve({ status: 'error', message: 'Lỗi đồng bộ: Không thể kết nối với máy chủ.' });
            }
        }, 1500);
    });
};


interface SyncResult {
    status: 'success' | 'error';
    message: string;
}

const ExamManager: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  const [selectedExamForVariants, setSelectedExamForVariants] = useState<Exam | null>(null);
  const [syncingExamId, setSyncingExamId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, SyncResult>>({});


  useEffect(() => {
    const loadExams = async () => {
      const data = await fetchExamsApi();
      setExams(data);
    };
    loadExams();
  }, []);

  const handleAddNew = () => {
    setEditingExam(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bài thi này?')) {
      await deleteExamApi(id);
      setExams(exams.filter((exam) => exam.id !== id));
    }
  };

  const handleModalClose = () => {
    setIsFormModalOpen(false);
    setIsVariantsModalOpen(false);
    setEditingExam(null);
    setSelectedExamForVariants(null);
  };

  const handleModalSave = async (exam: Exam) => {
    if (exam.id) {
      const updatedExam = await updateExamApi(exam);
      setExams(exams.map((e) => (e.id === updatedExam.id ? updatedExam : e)));
    } else {
      const newExam = await createExamApi(exam);
      setExams([...exams, newExam]);
    }
    handleModalClose();
  };

  const handleSync = async (examId: string) => {
    setSyncingExamId(examId);
    setSyncResult({}); // Clear previous sync results
    try {
        const result = await syncExamApi(examId);
        setSyncResult(prev => ({ ...prev, [examId]: { status: result.status, message: result.message } }));

        if (result.status === 'success') {
            setExams(prevExams => prevExams.map(exam =>
                exam.id === examId
                    ? { ...exam, isSynced: true, snapshotVariantIds: result.snapshotVariantIds || [] }
                    : exam
            ));
        } else {
            // If sync fails, ensure isSynced is false and snapshotVariantIds are cleared/empty
            setExams(prevExams => prevExams.map(exam =>
                exam.id === examId
                    ? { ...exam, isSynced: false, snapshotVariantIds: [] }
                    : exam
            ));
        }
    } catch (error) {
        console.error('Lỗi khi đồng bộ bài thi:', error);
        setSyncResult(prev => ({ ...prev, [examId]: { status: 'error', message: 'Đã xảy ra lỗi không mong muốn.' } }));
        setExams(prevExams => prevExams.map(exam =>
            exam.id === examId
                ? { ...exam, isSynced: false, snapshotVariantIds: [] }
                : exam
        ));
    } finally {
        setSyncingExamId(null);
    }
  };

  const handleViewVariants = (exam: Exam) => {
    setSelectedExamForVariants(exam);
    setIsVariantsModalOpen(true);
  };

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Quản lý Bài thi</h3>
            <button
            onClick={handleAddNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
            >
                <PlusCircleIcon className="w-5 h-5" />
                <span className="ml-2">Tạo bài thi mới</span>
            </button>
        </div>

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tiêu đề Bài thi</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số biến thể</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {exams.map((exam) => {
                        const variantIds = Array.isArray(exam.snapshotVariantIds) ? exam.snapshotVariantIds : [];
                        const syncedCount = variantIds.length;
                        const totalVariants = typeof exam.variants === 'number' && exam.variants > 0
                            ? exam.variants
                            : Math.max(syncedCount, 1); // Đảm bảo totalVariants ít nhất là 1 nếu exam.variants là 0 hoặc không hợp lệ
                        const isTrulySynced = !!(exam.isSynced && syncedCount > 0); // Chỉ coi là "Đã đồng bộ" nếu isSynced true VÀ có ít nhất 1 variant

                        return (
                        <tr key={exam.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {isTrulySynced ? (
                                    <span className="flex items-center text-sm font-medium text-emerald-600">
                                        <CheckCircleIcon className="w-5 h-5 mr-1" /> Đã đồng bộ
                                    </span>
                                ) : (
                                    <span className="flex items-center text-sm font-medium text-amber-600">
                                        <ExclamationCircleIcon className="w-5 h-5 mr-1"/> Chưa đồng bộ
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-semibold text-gray-900">{exam.title}</div>
                                <div className="text-xs text-gray-500">ID: {exam.id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {isTrulySynced ? `${syncedCount} / ${totalVariants}` : `0 / ${totalVariants}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handleSync(exam.id)}
                                        disabled={syncingExamId === exam.id}
                                        className="p-2 text-gray-500 hover:text-sky-600 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:cursor-wait transition-colors"
                                        title="Đồng bộ để tạo bộ đề thi"
                                    >
                                       {syncingExamId === exam.id ? <LoadingSpinner/> : <RefreshIcon className="w-5 h-5" />}
                                    </button>
                                    <button onClick={() => handleEdit(exam)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-full transition-colors" title="Sửa"><PencilIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleDelete(exam.id)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-gray-100 rounded-full transition-colors" title="Xóa"><TrashIcon className="w-5 h-5"/></button>
                                    {isTrulySynced && (
                                        <button onClick={() => handleViewVariants(exam)} className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-gray-100 rounded-full transition-colors" title="Xem các biến thể"><ViewListIcon className="w-5 h-5"/></button>
                                    )}
                                </div>
                            </td>
                        </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </div>

        {Object.keys(syncResult).length > 0 && (
            <div className="mt-4 space-y-2">
                {Object.entries(syncResult).map(([examId, result]) => (
                <div key={examId} className={`p-3 rounded-lg text-sm ${result.status === 'success' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>
                    <strong>Bài thi {exams.find(e => e.id === examId)?.title}:</strong> {result.message}
                </div>
                ))}
            </div>
        )}

      {isFormModalOpen && <ExamFormModal isOpen={isFormModalOpen} onClose={handleModalClose} onSave={handleModalSave} initialExam={editingExam} />}
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