import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Exam, QuestionWithExamDetails } from '../../types';
import { getAdminDashboardData, deleteExam, runSyncAndCreateSnapshots } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import Pagination from './Pagination';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import ExamFormModal from './ExamFormModal';
import { PencilIcon } from '../icons/PencilIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { RefreshIcon } from '../icons/RefreshIcon';
import { ViewListIcon } from '../icons/ViewListIcon';
import ExamVariantsModal from './ExamVariantsModal';
import ConfirmationModal from './ConfirmationModal';

const ITEMS_PER_PAGE = 5;

const ExamManager: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<QuestionWithExamDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(''); // Chỉ dành cho lỗi tải dữ liệu ban đầu
  const [currentPage, setCurrentPage] = useState(1);
  
  // State dành riêng cho chức năng đồng bộ
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState(''); // State mới cho lỗi đồng bộ

  // State for modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [viewingVariantsExam, setViewingVariantsExam] = useState<Exam | null>(null);
  
  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getAdminDashboardData();
      setExams(data.exams);
      setQuestions(data.questions);
    } catch (err: any) {
        console.error("Failed to fetch exam data", err);
        setError("Không thể tải dữ liệu bài thi. Vui lòng kiểm tra kết nối mạng và thử lại.");
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allTopics = useMemo(() => [...new Set(questions.map(q => q.topic))], [questions]);
  const allDifficulties = useMemo(() => [...new Set(questions.map(q => q.difficulty))], [questions]);

  // Modal handlers
  const handleAddNewExam = () => {
    setEditingExam(null);
    setIsFormModalOpen(true);
  };

  const handleEditExam = (exam: Exam) => {
    setEditingExam(exam);
    setIsFormModalOpen(true);
  };

  const handleDeleteExam = (examId: string) => {
    setConfirmTitle('Xác nhận xóa bài thi');
    setConfirmMessage('Bạn có chắc chắn muốn xóa bài thi này không? Hành động này không thể hoàn tác.');
    setConfirmAction(() => async () => {
        try {
            await deleteExam(examId);
            fetchData(); // Refresh list
        } catch (error) {
            console.error("Failed to delete exam", error);
            alert("Không thể xóa bài thi. Vui lòng thử lại.");
        }
    });
    setIsConfirmModalOpen(true);
  };

  const handleFormModalClose = () => {
    setIsFormModalOpen(false);
    setEditingExam(null);
  };

  const handleFormModalSave = () => {
    handleFormModalClose();
    // Delay fetching to allow backend to process
    setTimeout(() => {
        fetchData();
    }, 500);
  };

  const handleSync = () => {
    setConfirmTitle('Xác nhận đồng bộ');
    setConfirmMessage('Hành động này sẽ tạo lại file câu hỏi cho TẤT CẢ các bài thi dựa trên dữ liệu mới nhất trong Sheet. Bạn có muốn tiếp tục?');
    setConfirmAction(() => async () => {
        setIsSyncing(true);
        setSyncMessage('');
        setSyncError('');
        try {
            const result = await runSyncAndCreateSnapshots();
            let successMsg = '';
            let errorMsg = '';
            if (result.successes && result.successes.length > 0) {
                successMsg = `Đồng bộ thành công ${result.successes.length} bài thi.`;
            }
            if (result.failures && result.failures.length > 0) {
                const failureDetails = result.failures.map(f => `- ${f.examTitle}: ${f.error}`).join('\n');
                errorMsg = `Đồng bộ thất bại cho ${result.failures.length} bài thi:\n${failureDetails}`;
            }
            setSyncMessage(successMsg);
            setSyncError(errorMsg);
            if (result.successes && result.successes.length > 0) {
                await fetchData();
            }
        } catch (err: any) {
            console.error('Lỗi hệ thống khi đồng bộ:', err);
            setSyncMessage('');
            setSyncError(`Lỗi hệ thống khi đồng bộ: ${err.message}. Vui lòng kiểm tra Console để biết thêm chi tiết.`);
        } finally {
            setIsSyncing(false);
        }
    });
    setIsConfirmModalOpen(true);
  };

  const totalPages = Math.ceil(exams.length / ITEMS_PER_PAGE);
  const paginatedExams = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return exams.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [exams, currentPage]);

  return (
    <div>
      <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-gray-900">Quản lý bài thi</h3>
        <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing || isLoading}
              className={`bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors disabled:bg-emerald-400 disabled:cursor-wait ${isSyncing ? 'animate-pulse' : ''}`}
            >
              {isSyncing ? <LoadingSpinner/> : <RefreshIcon className="h-5 w-5"/>}
              <span className="ml-2">{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
            </button>
            <button
              onClick={handleAddNewExam}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
            >
              <PlusCircleIcon />
              <span className="ml-2">Tạo bài thi mới</span>
            </button>
        </div>
      </div>
       <div className="mb-4 bg-sky-50 border border-sky-200 text-sky-800 p-3 rounded-lg text-sm">
            <strong>Quan trọng:</strong> Bài thi cần được 'đồng bộ' để tạo bộ câu hỏi tĩnh cho học viên. Bài thi ở trạng thái <strong className="text-amber-900">"Chưa đồng bộ"</strong> sẽ không thể bắt đầu. Sau khi tạo hoặc sửa bài thi, hãy nhấn nút "Đồng bộ".
       </div>
       
       {syncMessage && <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-sm">{syncMessage}</div>}
       {syncError && <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-sm whitespace-pre-wrap">{syncError}</div>}


      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-4 text-gray-600">Đang tải bài thi...</p>
        </div>
      ) : error ? (
        <div className="text-center bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">{error}</div>
      ) : (
        <>
            <div className="space-y-4">
            {paginatedExams.map((exam) => {
              let blueprintRules: { count: number; difficulty: string; topic: string }[] = [];
              let blueprintError = false;

              if (typeof exam.blueprint === 'string' && exam.blueprint.trim().startsWith('[')) {
                try {
                  blueprintRules = JSON.parse(exam.blueprint);
                } catch (e) {
                  console.error(`Could not parse blueprint JSON for exam ${exam.id}:`, exam.blueprint);
                  blueprintError = true;
                }
              } else if (Array.isArray(exam.blueprint)) {
                blueprintRules = exam.blueprint;
              } else if (typeof exam.blueprint === 'string' && exam.blueprint) {
                blueprintError = true;
              }
              
              const isSynced = !!exam.questionsSnapshotUrl;

              return (
                <div key={exam.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3">
                           <h4 className="text-lg font-bold text-indigo-600">{exam.title}</h4>
                           {isSynced ? (
                                <span className="text-xs font-medium bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full">Đã đồng bộ</span>
                           ) : (
                                <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded-full">Chưa đồng bộ</span>
                           )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{exam.description}</p>
                    </div>
                    <div className="flex-shrink-0 space-x-2">
                        <button 
                            onClick={() => setViewingVariantsExam(exam)} 
                            disabled={!isSynced}
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                            title={isSynced ? "Xem các biến thể" : "Bài thi chưa được đồng bộ"}
                        >
                            <ViewListIcon/>
                        </button>
                        <button onClick={() => handleEditExam(exam)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-full transition-colors" title="Sửa bài thi"><PencilIcon/></button>
                        <button onClick={() => handleDeleteExam(exam.id)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-gray-200 rounded-full transition-colors" title="Xóa bài thi"><TrashIcon/></button>
                    </div>
                  </div>
                  <div className="mt-4">
                      <h5 className="font-semibold text-gray-700 mb-2">Ma trận đề thi:</h5>
                      {blueprintError ? (
                        <div className="bg-rose-100 text-rose-800 p-2 rounded-md text-sm">
                          Lỗi: Không thể tải ma trận đề thi. Vui lòng kiểm tra dữ liệu trong Google Sheet.
                        </div>
                      ) : blueprintRules.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {blueprintRules.map((rule, index) => (
                            <div key={index} className="bg-white p-2 rounded-md border text-sm text-gray-700">
                              <span className="font-semibold text-gray-900">{rule.count}x</span>
                              <span className="capitalize ml-1">{rule.difficulty}</span>
                              <span className="text-gray-500"> - {rule.topic}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                         <p className="text-sm text-gray-500 italic">Không có quy tắc ma trận nào được định nghĩa.</p>
                      )}
                  </div>
                </div>
              );
            })}
            </div>
            <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </>
      )}

      {isFormModalOpen && (
        <ExamFormModal
            isOpen={isFormModalOpen}
            onClose={handleFormModalClose}
            onSave={handleFormModalSave}
            initialExam={editingExam}
            allTopics={allTopics}
            allDifficulties={allDifficulties}
        />
      )}

      {viewingVariantsExam && (
        <ExamVariantsModal
            isOpen={!!viewingVariantsExam}
            onClose={() => setViewingVariantsExam(null)}
            exam={viewingVariantsExam}
        />
      )}
      
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmAction!}
        title={confirmTitle}
        message={<p>{confirmMessage}</p>}
      />
    </div>
  );
};

export default ExamManager;
