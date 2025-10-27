import React, { useState, useEffect, useCallback, useMemo } from 'react';
// FIX: Import QuestionWithExamDetails and correct associated types.
import type { QuestionWithExamDetails } from '../../types';
// FIX: Replaced missing 'getAllQuestions' with 'getAdminDashboardData'.
import { getAdminDashboardData, deleteQuestion } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { TrashIcon } from '../icons/TrashIcon';
import QuestionFormModal from './QuestionFormModal';
import Pagination from './Pagination';
import { CloudDownloadIcon } from '../icons/CloudDownloadIcon';
import { convertToDirectGoogleDriveLink } from '../../utils/imageUtils';
import ImageModal from '../ImageModal';

const ITEMS_PER_PAGE = 5;

const QuestionBankManager: React.FC = () => {
  // FIX: Updated state to use the more specific QuestionWithExamDetails type.
  const [questions, setQuestions] = useState<QuestionWithExamDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // FIX: Updated state to use the more specific QuestionWithExamDetails type.
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithExamDetails | null>(null);
  const [filterTopic, setFilterTopic] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // State for image modal
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');


  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await getAdminDashboardData();
      setQuestions(data.questions);
    } catch (err: any) {
        console.error("Failed to fetch questions", err);
        setError('Không thể tải ngân hàng câu hỏi. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    setCurrentPage(1); // Reset page when filter changes
  }, [filterTopic]);

  const topics = useMemo(() => {
    const allTopics = questions.map(q => q.topic);
    return [...new Set(allTopics)];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    if (!filterTopic) return questions;
    return questions.filter(q => q.topic === filterTopic);
  }, [questions, filterTopic]);
  
  const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
  const paginatedQuestions = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredQuestions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredQuestions, currentPage]);


  const handleAddNew = () => {
    setEditingQuestion(null);
    setIsModalOpen(true);
  };

  // FIX: Updated parameter type to match the state.
  const handleEdit = (question: QuestionWithExamDetails) => {
    setEditingQuestion(question);
    setIsModalOpen(true);
  };

  const handleDelete = async (questionId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này không?')) {
      try {
        await deleteQuestion(questionId);
        await fetchQuestions(); // Refresh list
      } catch (error) {
        console.error('Failed to delete question:', error);
        alert('Không thể xóa câu hỏi. Vui lòng thử lại.');
      }
    }
  };
  
  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingQuestion(null);
  };
  
  const handleModalSave = () => {
    handleModalClose();
    fetchQuestions(); // Refresh data after save
  }

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    setError('');
    try {
      // Re-fetch all data from the source (Google Sheet via GAS)
      const data = await getAdminDashboardData();
      setQuestions(data.questions);
      setSyncMessage(`Đồng bộ thành công lúc ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('Lỗi khi đồng bộ:', err);
      setSyncMessage('');
      setError('Đồng bộ thất bại. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenImageModal = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-gray-900">Ngân hàng câu hỏi</h3>
        <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing || isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors disabled:bg-emerald-300"
            >
              {isSyncing ? <LoadingSpinner/> : <CloudDownloadIcon />}
              <span className="ml-2">{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Sheet'}</span>
            </button>
            <button
              onClick={handleAddNew}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
            >
              <PlusCircleIcon />
              <span className="ml-2">Thêm câu hỏi</span>
            </button>
        </div>
      </div>
      {syncMessage && <p className="text-sm text-emerald-700 mb-4">{syncMessage}</p>}


      <div className="mb-4">
        <label htmlFor="topic-filter" className="block text-sm font-medium text-gray-700">Lọc theo chủ đề</label>
        <select 
            id="topic-filter"
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="mt-1 block w-full md:w-1/3 p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
            <option value="">Tất cả chủ đề</option>
            {topics.map(topic => <option key={topic} value={topic}>{topic}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-4 text-gray-600">Đang tải câu hỏi...</p>
        </div>
      ) : error ? (
        <div className="text-center bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">{error}</div>
      ) : (
        <>
            <div className="space-y-4">
            {paginatedQuestions.map((q) => {
                const directImageUrl = convertToDirectGoogleDriveLink(q.imageUrl);
                return (
                <div key={q.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 bg-indigo-100 inline-block px-2 py-1 rounded-full mb-2">{q.topic}</p>
                        <div className="text-gray-900 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: q.stem }} />
                         {directImageUrl && (
                            <button
                                type="button"
                                onClick={() => handleOpenImageModal(directImageUrl)}
                                className="mt-3 bg-gray-100 rounded-lg p-2 border border-gray-200 inline-block hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                            >
                                <img 
                                    src={directImageUrl} 
                                    alt="Hình minh họa" 
                                    className="max-h-40 w-auto object-contain rounded-md" 
                                />
                            </button>
                        )}
                    </div>
                    <div className="flex-shrink-0 flex items-center space-x-2 ml-4">
                        <button onClick={() => handleEdit(q)} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-full transition-colors"><PencilIcon/></button>
                        <button onClick={() => handleDelete(q.id)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-gray-200 rounded-full transition-colors"><TrashIcon/></button>
                    </div>
                </div>
                <ul className="mt-3 space-y-2">
                    {q.options.map(opt => (
                    <li key={opt.id} className={`text-sm pl-4 py-1 rounded ${opt.id === q.answer_key ? 'bg-emerald-100 text-emerald-800 border-l-4 border-emerald-500 font-semibold' : 'text-gray-700'}`}>
                        {opt.text}
                    </li>
                    ))}
                </ul>
                {q.usedInExams && q.usedInExams.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-600">Được sử dụng trong bài thi:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {q.usedInExams.map(ex => (
                                <span key={ex.examId} className="text-xs bg-gray-200 text-gray-800 px-2 py-1 rounded-full">{ex.examTitle}</span>
                            ))}
                        </div>
                    </div>
                )}
                </div>
            )})}
            </div>
            <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </>
      )}
      
      {isImageModalOpen && (
        <ImageModal 
            isOpen={isImageModalOpen}
            onClose={() => setIsImageModalOpen(false)}
            imageUrl={selectedImageUrl}
        />
      )}

      {isModalOpen && (
        <QuestionFormModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            onSave={handleModalSave}
            // FIX: Removed unsafe type cast. The 'editingQuestion' state now has the correct type.
            initialQuestion={editingQuestion}
        />
      )}
    </div>
  );
};

export default QuestionBankManager;