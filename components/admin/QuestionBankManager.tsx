import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import type { Question } from '../../types';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { PencilIcon } from '../icons/PencilIcon';
import { TrashIcon } from '../icons/TrashIcon';
import { CloudUploadIcon } from '../icons/CloudUploadIcon';
import QuestionFormModal from './QuestionFormModal';
import Pagination from './Pagination';
import ImageModal from '../ImageModal';
import CsvImporter from './CsvImporter'; // The upgraded component
import { convertToDirectGoogleDriveLink } from '../../utils/imageUtils';

const ITEMS_PER_PAGE = 10;

const QuestionBankManager: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [filterTopic, setFilterTopic] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // State for importer visibility and progress
  const [showImporter, setShowImporter] = useState(false);
  const [importStatus, setImportStatus] = useState({ message: '', type: '' }); // type can be 'progress', 'success', or 'error'

  // State for image modal
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');

  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const db = getFirestore();
      const questionsCol = collection(db, 'questionBank');
      const questionSnapshot = await getDocs(questionsCol);
      const questionList = questionSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Question);
      setQuestions(questionList);
    } catch (err: any) {
        console.error("Failed to fetch questions from Firestore", err);
        setError('Không thể tải ngân hàng câu hỏi từ cơ sở dữ liệu. Vui lòng thử lại.');
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTopic]);

  const topics = useMemo(() => {
    const allTopics = questions.map(q => q.topic).filter(Boolean);
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

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setIsModalOpen(true);
  };

  const handleDelete = async (questionId: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng câu hỏi không?')) {
      try {
        const db = getFirestore();
        await deleteDoc(doc(db, 'questionBank', questionId));
        await fetchQuestions(); // Refresh list
      } catch (error) {
        console.error('Failed to delete question:', error);
        setError('Không thể xóa câu hỏi. Vui lòng thử lại.');
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

  // --- New Handlers for the upgraded Importer ---
  const handleImportProgress = (message: string) => {
    setImportStatus({ message, type: 'progress' });
  };

  const handleImportComplete = (totalImported: number) => {
    setImportStatus({ message: `Nhập thành công! Đã xử lý ${totalImported} câu hỏi. Đang làm mới danh sách...`, type: 'success' });
    fetchQuestions(); // Refresh the list
    // Hide the success message after 5 seconds
    setTimeout(() => setImportStatus({ message: '', type: '' }), 5000);
  };

  const handleImportError = (errorMessage: string) => {
    setImportStatus({ message: `Lỗi khi nhập: ${errorMessage}`, type: 'error' });
  };
  // ----------------------------------------------

  const handleOpenImageModal = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setIsImageModalOpen(true);
  };

  const getStatusColor = () => {
      switch(importStatus.type) {
          case 'success': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
          case 'error': return 'text-rose-700 bg-rose-50 border-rose-200';
          case 'progress': return 'text-sky-700 bg-sky-50 border-sky-200';
          default: return 'hidden';
      }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-gray-900">Ngân hàng câu hỏi</h3>
        <div className="flex gap-2">
            <button
              onClick={() => setShowImporter(!showImporter)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
            >
              <CloudUploadIcon />
              <span className="ml-2">{showImporter ? 'Đóng Nhập liệu' : 'Nhập từ CSV'}</span>
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
      
      {importStatus.message && (
        <div className={`p-3 my-4 border rounded-lg text-sm ${getStatusColor()}`}>
            {importStatus.message}
        </div>
      )}

      {showImporter && (
          <CsvImporter 
            onProgress={handleImportProgress}
            onImportComplete={handleImportComplete} 
            onImportError={handleImportError} 
          />
      )}

      <div className="mb-4 mt-6">
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
                const directImageUrl = q.imageUrl ? convertToDirectGoogleDriveLink(q.imageUrl) : '';
                return (
                <div key={q.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 bg-indigo-100 inline-block px-2 py-1 rounded-full mb-2">{q.topic}</p>
                        <p className="text-gray-900 font-medium">{q.questionText}</p>
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
                    {q.options.map((opt, index) => (
                    <li key={index} className={`text-sm pl-4 py-1 rounded ${opt === q.correctAnswer ? 'bg-emerald-100 text-emerald-800 border-l-4 border-emerald-500 font-semibold' : 'text-gray-700'}`}>
                        {opt}
                    </li>
                    ))}
                </ul>
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
            initialQuestion={editingQuestion}
        />
      )}
    </div>
  );
};

export default QuestionBankManager;
