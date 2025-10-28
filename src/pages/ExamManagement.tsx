import React, { useState, useEffect, useCallback } from 'react';
import { getExams, deleteExamWithVariants, generateExamVariants } from '../../services/firebaseExamService';
import type { Exam } from '../../types';
import ExamFormModal from './ExamFormModal';
import ExamVariantsModal from './ExamVariantsModal';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { ViewListIcon } from '../icons/ViewListIcon';
import { CheckCircleIcon } from '../icons/CheckCircleIcon';
import { ExclamationCircleIcon } from '../icons/ExclamationCircleIcon';

const ExamManager: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [selectedExamForVariants, setSelectedExamForVariants] = useState<Exam | null>(null);
  
  // State for synchronization process
  const [syncingExamId, setSyncingExamId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ [examId: string]: { status: 'success' | 'error'; message: string } }>({});

  const fetchExams = useCallback(async () => {
    setIsLoading(true);
    try {
      const examList = await getExams();
      setExams(examList.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    } catch (err) {
      setError('Không thể tải danh sách bài thi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleAddNew = () => {
    setEditingExam(null);
    setIsFormModalOpen(true);
  };

  const handleEdit = (exam: Exam) => {
    setEditingExam(exam);
    setIsFormModalOpen(true);
  };

  const handleDelete = async (examId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bài thi này và tất cả các biến thể của nó không? Hành động này không thể hoàn tác.')) {
      try {
        await deleteExamWithVariants(examId);
        fetchExams();
      } catch (error) {
        setError('Không thể xóa bài thi. Vui lòng thử lại.');
        console.error('Deletion error:', error);
      }
    }
  };

  const handleSync = async (examId: string) => {
    setSyncingExamId(examId);
    setSyncResult(prev => ({ ...prev, [examId]: { status: 'success', message: 'Đang đồng bộ...' } }));

    try {
      const result = await generateExamVariants(examId); // Call the NEW function

      if (result.success) {
        setSyncResult(prev => ({ ...prev, [examId]: { status: 'success', message: result.message } }));
        await fetchExams(); // Refresh the exam list to show synced status
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
        console.error('Sync error:', err);
        setSyncResult(prev => ({ ...prev, [examId]: { status: 'error', message: err.message || 'Đồng bộ thất bại với lỗi không xác định.' } }));
    } finally {
      setSyncingExamId(null);
      // Keep the message for 10 seconds
      setTimeout(() => {
          setSyncResult(prev => { 
              const newResult = { ...prev };
              delete newResult[examId];
              return newResult;
          });
      }, 10000);
    }
  };

  const handleViewVariants = (exam: Exam) => {
    setSelectedExamForVariants(exam);
    setIsVariantsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsFormModalOpen(false);
    setIsVariantsModalOpen(false);
    setEditingExam(null);
    setSelectedExamForVariants(null);
  };

  const handleModalSave = () => {
    handleModalClose();
    fetchExams();
  };

  if (isLoading) return <div className="flex justify-center items-center h-64"><LoadingSpinner /> <p className="ml-4">Đang tải...</p></div>;
  if (error) return <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">Lỗi: {error}</div>;

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Quản lý Bài thi</h3>
            <button
            onClick={handleAddNew}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
            >
                <PlusCircleIcon />
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
                        const isTrulySynced = !!(exam.isSynced && Array.isArray(exam.snapshotVariantIds) && exam.snapshotVariantIds.length > 0);
                        
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
                                {isTrulySynced ? exam.snapshotVariantIds.length : '0'} / {exam.variants}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-2">
                                    <button 
                                        onClick={() => handleSync(exam.id)} 
                                        disabled={syncingExamId === exam.id}
                                        className="p-2 text-gray-500 hover:text-sky-600 hover:bg-gray-100 rounded-full disabled:opacity-50 disabled:cursor-wait transition-colors"
                                        title="Đồng bộ để tạo bộ đề thi"
                                    >
                                       {syncingExamId === exam.id ? <LoadingSpinner/> : <RefreshIcon />}
                                    </button>
                                    <button onClick={() => handleEdit(exam)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-full transition-colors" title="Sửa"><PencilIcon/></button>
                                    <button onClick={() => handleDelete(exam.id)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-gray-100 rounded-full transition-colors" title="Xóa"><TrashIcon/></button>
                                    {isTrulySynced && (
                                        <button onClick={() => handleViewVariants(exam)} className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-gray-100 rounded-full transition-colors" title="Xem các biến thể"><ViewListIcon/></button>
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
      {isVariantsModalOpen && <ExamVariantsModal isOpen={isVariantsModalOpen} onClose={handleModalClose} exam={selectedExamForVariants} />}
    </div>
  );
};

export default ExamManager;
