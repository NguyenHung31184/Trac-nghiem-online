import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Attempt, AttemptWithDetails, User, Exam, Class } from '../../types';
import { getAllAttemptsFromFirestore, getAdminDashboardData } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { EyeIcon } from '../icons/EyeIcon';
import { ExclamationCircleIcon } from '../icons/ExclamationCircleIcon';
import Pagination from './Pagination';

interface ResultsManagerProps {
    onViewProctoringReport: (attemptId: string) => void;
}

type SortKey = 'userName' | 'examTitle' | 'score' | 'completed_at';
const ITEMS_PER_PAGE = 10;

const ResultsManager: React.FC<ResultsManagerProps> = ({ onViewProctoringReport }) => {
  const [attempts, setAttempts] = useState<AttemptWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('completed_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(async () => {
      setIsLoading(true);
      setError('');
      try {
          // Lấy đồng thời dữ liệu "nóng" từ Firestore và "lạnh" từ GAS
          const [firestoreAttempts, adminData] = await Promise.all([
              getAllAttemptsFromFirestore(),
              getAdminDashboardData() // Vẫn cần để lấy thông tin bổ sung
          ]);

          // Tạo các map để tra cứu nhanh
          const userMap = new Map(adminData.students.map(s => [s.id, s]));
          const examMap = new Map(adminData.exams.map(e => [e.id, e]));
          const classMap = new Map(adminData.classes.map(c => [c.id, c.name]));

          // Kết hợp dữ liệu
          const attemptsWithDetails: AttemptWithDetails[] = firestoreAttempts.map(a => {
              const user = userMap.get(a.userId);
              const exam = examMap.get(a.examId);
              const className = (user?.classIds || [])
                .map(id => classMap.get(id))
                .filter(Boolean)
                .join(', ');
              
              return {
                  ...a,
                  userName: user?.name || 'Unknown User',
                  examTitle: exam?.title || 'Unknown Exam',
                  className: className || 'Unknown Class',
              }
          });
          
          setAttempts(attemptsWithDetails);
      } catch (err: any) {
          console.error("Lỗi khi tải kết quả:", err);
          setError("Không thể tải dữ liệu kết quả. Vui lòng kiểm tra kết nối mạng và thử lại.");
      } finally {
          setIsLoading(false);
      }
  }, []);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedAttempts = useMemo(() => {
    return [...attempts].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      
      if (valA === null) return 1;
      if (valB === null) return -1;
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [attempts, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedAttempts.length / ITEMS_PER_PAGE);
  const paginatedAttempts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedAttempts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedAttempts, currentPage]);


  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setCurrentPage(1); // Reset to first page on sort
  };
  
  const SortableHeader: React.FC<{ sortKey: SortKey; label: string }> = ({ sortKey: key, label }) => (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort(key)}>
      <div className="flex items-center">
        <span>{label}</span>
        {sortKey === key && <span className="ml-1">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
      </div>
    </th>
  );


  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-gray-900">Kết quả thi</h3>
        <button className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-2 px-4 rounded-lg text-sm">Xuất CSV</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-4 text-gray-600">Đang tải kết quả...</p>
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
                        <SortableHeader sortKey="userName" label="Học viên" />
                        <SortableHeader sortKey="examTitle" label="Bài thi" />
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lớp</th>
                        <SortableHeader sortKey="score" label="Điểm" />
                        <SortableHeader sortKey="completed_at" label="Ngày hoàn thành" />
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                    {paginatedAttempts.map((attempt) => (
                        <tr key={attempt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            <div className="flex items-center">
                                {attempt.userName}
                                {attempt.reviewRequested && (
                                <span title="Yêu cầu xem lại">
                                    <ExclamationCircleIcon className="h-5 w-5 text-amber-500 ml-2" />
                                </span>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{attempt.examTitle}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{attempt.className}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-semibold">{attempt.score !== null ? `${(attempt.score * 100).toFixed(1)}%` : 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : 'Đang làm bài'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            <button onClick={() => onViewProctoringReport(attempt.id)} className="text-indigo-600 hover:text-indigo-800 flex items-center" title="Xem nhật ký giám sát">
                                <EyeIcon />
                                <span className="ml-1">Xem nhật ký</span>
                            </button>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="space-y-3 md:hidden">
                {paginatedAttempts.map((attempt) => (
                    <div key={attempt.id} className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                                <p className="font-bold text-gray-900 flex items-center">
                                    <span>{attempt.userName}</span>
                                    {attempt.reviewRequested && (
                                    <span title="Yêu cầu xem lại">
                                        <ExclamationCircleIcon className="h-5 w-5 text-amber-500 ml-2 flex-shrink-0" />
                                    </span>
                                    )}
                                </p>
                                <p className="text-sm text-gray-500">{attempt.examTitle}</p>
                            </div>
                            <span className={`flex-shrink-0 font-semibold text-lg px-3 py-1 rounded-full ${attempt.score === null ? 'bg-gray-100 text-gray-800' : attempt.score < 0.7 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {attempt.score !== null ? `${(attempt.score * 100).toFixed(1)}%` : 'N/A'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pt-3 border-t">
                            <span className="text-gray-500">Lớp:</span>
                            <span className="text-gray-800 font-medium">{attempt.className}</span>
                            <span className="text-gray-500">Hoàn thành:</span>
                            <span className="text-gray-800 font-medium">{attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : 'Đang làm bài'}</span>
                        </div>
                         <button onClick={() => onViewProctoringReport(attempt.id)} className="w-full text-center mt-2 bg-gray-50 hover:bg-gray-100 text-indigo-600 flex items-center justify-center py-2 rounded-md text-sm font-semibold" title="Xem nhật ký giám sát">
                            <EyeIcon />
                            <span className="ml-2">Xem nhật ký giám sát</span>
                        </button>
                    </div>
                ))}
            </div>

            <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />
        </>
      )}
    </div>
  );
};

export default ResultsManager;