import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ExamWindow, Exam, Class } from '../../types';
import { getAdminDashboardData } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import Pagination from './Pagination';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import SchedulingFormModal from './SchedulingFormModal';

const ITEMS_PER_PAGE = 10;

const SchedulingManager: React.FC = () => {
  const [windows, setWindows] = useState<ExamWindow[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const fetchData = useCallback(async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await getAdminDashboardData();
        setWindows(data.windows);
        setExams(data.exams);
        setClasses(data.classes);
      } catch (err: any) {
        console.error("Failed to fetch scheduling data:", err);
        setError("Không thể tải dữ liệu lịch thi. Vui lòng kiểm tra kết nối mạng và thử lại.");
      } finally {
        setIsLoading(false);
      }
    }, []);
  
    useEffect(() => {
      fetchData();
    }, [fetchData]);
  
    const handleModalClose = () => {
      setIsModalOpen(false);
    };
  
    const handleModalSave = () => {
      handleModalClose();
      fetchData(); // Refresh data after saving
    };
  
    const totalPages = Math.ceil(windows.length / ITEMS_PER_PAGE);
    const paginatedWindows = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      // Sort by start date, most recent first
      const sortedWindows = [...windows].sort((a, b) => b.start_at - a.start_at);
      return sortedWindows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [windows, currentPage]);
  
    const examMap = new Map(exams.map(e => [e.id, e.title]));
    const classMap = new Map(classes.map(c => [c.id, c]));
  
    const getStatus = (start: number, end: number) => {
      const now = Date.now();
      if (now < start) return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-sky-100 text-sky-800">Sắp diễn ra</span>;
      if (now > end) return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-rose-100 text-rose-800">Đã hết hạn</span>;
      return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">Đang hoạt động</span>;
    };
  
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Lên lịch thi</h3>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center transition-colors"
          >
            <PlusCircleIcon />
            <span className="ml-2">Lên lịch ca thi mới</span>
          </button>
        </div>
  
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner />
            <p className="ml-4 text-gray-600">Đang tải lịch thi...</p>
          </div>
        ) : error ? (
          <div className="text-center bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">{error}</div>
        ) : (
          <>
              {/* Desktop Table View */}
              <div className="overflow-x-auto rounded-lg border border-gray-200 hidden md:block">
              <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                  <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bài thi</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lớp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã lớp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian bắt đầu</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời gian kết thúc</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã truy cập</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                  {paginatedWindows.map((w) => {
                      const classInfo = classMap.get(w.classId);
                      return (
                        <tr key={w.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{examMap.get(w.examId)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{classInfo?.name ?? w.classId}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{classInfo?.code ?? classInfo?.id ?? w.classId}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(w.start_at).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{new Date(w.end_at).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800"><code className="font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded-md">{w.accessCode}</code></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatus(w.start_at, w.end_at)}</td>
                        </tr>
                      );
                  })}
                  </tbody>
              </table>
              </div>
  
              {/* Mobile Card View */}
              <div className="space-y-3 md:hidden">
                   {paginatedWindows.map((w) => {
                      const classInfo = classMap.get(w.classId);
                      return (
                        <div key={w.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                              <p className="font-bold text-indigo-600 flex-1 pr-2">{examMap.get(w.examId)}</p>
                              {getStatus(w.start_at, w.end_at)}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pt-3 border-t">
                              <span className="text-gray-500">Lớp:</span>
                              <span className="text-gray-800 font-medium">{classInfo?.name ?? w.classId}</span>
                              <span className="text-gray-500">Mã lớp:</span>
                              <span className="text-gray-800 font-medium">{classInfo?.code ?? classInfo?.id ?? w.classId}</span>
                              <span className="text-gray-500">Mã truy cập:</span>
                              <code className="font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md text-xs self-center">{w.accessCode}</code>
                          </div>
                          <div className="text-sm text-gray-500 pt-3 border-t space-y-1">
                              <div><strong className="font-medium text-gray-700">Bắt đầu:</strong> {new Date(w.start_at).toLocaleString()}</div>
                              <div><strong className="font-medium text-gray-700">Kết thúc:</strong> {new Date(w.end_at).toLocaleString()}</div>
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
        
        {isModalOpen && (
          <SchedulingFormModal
              isOpen={isModalOpen}
              onClose={handleModalClose}
              onSave={handleModalSave}
              exams={exams}
              classes={classes}
          />
        )}
      </div>
    );
  };
  
  export default SchedulingManager;