import React, { useState, useEffect, useMemo } from 'react';
import type { Exam, Question } from '../../types';
import { getAdminDashboardData, getExamAnalytics } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import Pagination from './Pagination';

const ITEMS_PER_PAGE = 10;

const AnalyticsDashboard: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<Question[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingAnalytics, setIsFetchingAnalytics] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await getAdminDashboardData();
        setExams(data.exams);
        if (data.exams.length > 0) {
          setSelectedExamId(data.exams[0].id);
        }
      } catch (err) {
        console.error("Failed to fetch exams for analytics", err);
        setError("Không thể tải danh sách bài thi. Vui lòng kiểm tra kết nối mạng.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!selectedExamId) return;
      setIsFetchingAnalytics(true);
      setAnalyticsData(null);
      setError('');
      setCurrentPage(1); // Reset page when exam changes
      try {
        const data = await getExamAnalytics(selectedExamId);
        setAnalyticsData(data.questionAnalytics);
      } catch (err) {
        console.error("Failed to fetch analytics data", err);
        setError("Không thể tải dữ liệu phân tích cho bài thi này.");
      } finally {
        setIsFetchingAnalytics(false);
      }
    };
    fetchAnalytics();
  }, [selectedExamId]);

  const totalPages = Math.ceil((analyticsData?.length || 0) / ITEMS_PER_PAGE);
  const paginatedAnalytics = useMemo(() => {
      if (!analyticsData) return [];
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return analyticsData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [analyticsData, currentPage]);


  const renderDifficulty = (pValue: number) => {
    if (pValue > 0.8) return <span className="text-emerald-600">Dễ</span>;
    if (pValue < 0.3) return <span className="text-rose-600">Khó</span>;
    return <span className="text-amber-600">Trung bình</span>;
  };

  return (
    <div>
      <h3 className="text-2xl font-bold text-gray-900 mb-4">Phân tích bài thi</h3>
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
          <p className="ml-4 text-gray-600">Đang tải bài thi...</p>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label htmlFor="exam-select" className="block text-sm font-medium text-gray-700">Chọn bài thi để phân tích</label>
            <select
              id="exam-select"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="mt-1 block w-full md:w-1/2 p-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              {exams.map(exam => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
            </select>
          </div>
          
          {error && <div className="text-center bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg my-4">{error}</div>}

          {isFetchingAnalytics ? (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner />
                <p className="ml-4 text-gray-600">Đang tính toán phân tích...</p>
            </div>
          ) : analyticsData && !error ? (
            <>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nội dung câu hỏi</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chủ đề</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P-Value (Độ khó)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Diễn giải</th>
                    </tr>
                    </thead>
                    <tbody>
                    {paginatedAnalytics.map((q) => (
                        <tr key={q.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                        <td className="px-6 py-3 prose prose-sm max-w-md text-gray-800" dangerouslySetInnerHTML={{ __html: q.stem }}></td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">{q.topic}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-800">{q.analytics?.pValue ?? 'N/A'}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-bold">
                            {q.analytics?.pValue !== undefined ? renderDifficulty(q.analytics.pValue) : 'N/A'}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
                 <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </>
          ) : (
             !error && <p className="text-center text-gray-500 mt-8">Không có dữ liệu phân tích cho bài thi này.</p>
          )}
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;