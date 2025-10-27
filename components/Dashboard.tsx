import React, { useState, useEffect, useCallback } from 'react';
import type { User, Exam, Attempt, ExamWindow } from '../types';
import { getAvailableWindowsForUser, createAttempt } from '../services/examService';
import { LoadingSpinner } from './icons/LoadingSpinner';
import { BookOpenIcon } from './icons/BookOpenIcon';
import { ClockIcon } from './icons/ClockIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { RefreshIcon } from './icons/RefreshIcon';

interface DashboardProps {
  user: User;
  onStartExam: (exam: Exam, window: ExamWindow, attempt: Attempt) => void;
  globalError: string;
  clearGlobalError: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onStartExam, globalError, clearGlobalError }) => {
  const [windows, setWindows] = useState<(ExamWindow & { exam: Exam })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingWindowId, setStartingWindowId] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<{ [windowId: string]: string }>({});
  const [error, setError] = useState<{ [windowId: string]: string }>({});
  const [fetchError, setFetchError] = useState<string>('');

  const fetchWindows = useCallback(async () => {
    setIsLoading(true);
    setFetchError('');
    clearGlobalError();
    try {
      if (user) {
        const fetchedWindows = await getAvailableWindowsForUser(user);
        setWindows(fetchedWindows);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải các kỳ thi:', err);
      setFetchError('Không thể tải danh sách kỳ thi. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsLoading(false);
    }
  }, [user, clearGlobalError]);

  useEffect(() => {
    fetchWindows();
  }, [fetchWindows]);

  const getWindowStatus = (startTime: number, endTime: number) => {
    const now = Date.now();
    if (now < startTime) {
      return { state: 'upcoming' as const, message: `Sắp diễn ra lúc ${new Date(startTime).toLocaleTimeString()}` };
    }
    if (now > endTime) {
      return { state: 'expired' as const, message: 'Đã kết thúc' };
    }
    return { state: 'active' as const, message: '' };
  };

  const handleStartClick = async (window: ExamWindow & { exam: Exam }) => {
    clearGlobalError();
    setError(prev => ({ ...prev, [window.id]: '' }));

    // 1) Kiểm tra mã truy cập
    if ((accessCode[window.id] || '').trim() !== (window.accessCode || '').trim()) {
      setError(prev => ({ ...prev, [window.id]: 'Mã truy cập không hợp lệ.' }));
      return;
    }

    // 2) Kiểm tra có snapshot URL chưa (đã đồng bộ từ GAS)
    if (!window.exam.questionsSnapshotUrl) {
      setError(prev => ({ ...prev, [window.id]: 'Bài thi này chưa sẵn sàng. Vui lòng liên hệ quản trị viên.' }));
      return;
    }

    // 3) Chỉ cho bắt đầu khi ca còn hiệu lực
    const status = getWindowStatus(window.start_at, window.end_at);
    if (status.state !== 'active') {
      setError(prev => ({ ...prev, [window.id]: status.state === 'upcoming' ? 'Chưa đến thời gian bắt đầu.' : 'Ca thi đã kết thúc.' }));
      return;
    }

    setStartingWindowId(window.id);
    try {
      // Create attempt is now a local operation before calling the main onStartExam
      const newAttempt: Attempt = {
        id: `local_atm_${Date.now()}`,
        userId: user.id,
        examId: window.examId,
        windowId: window.id,
        status: 'in-progress',
        answers: {},
        score: null,
        started_at: Date.now(),
        completed_at: null,
        reviewRequested: false
      };
      onStartExam(window.exam, window, newAttempt);
    } catch (err) {
      console.error('Failed to create attempt:', err);
      alert('Không thể bắt đầu bài thi. Vui lòng thử lại.');
      setStartingWindowId(null);
    }
  };

  if (isLoading && windows.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
        <p className="ml-4 text-lg text-gray-600">Đang tải các kỳ thi có sẵn...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Chào mừng, {user.name}!</h2>
          <p className="mt-2 text-lg text-gray-600">Các kỳ thi đang hoạt động của bạn được liệt kê dưới đây.</p>
        </div>
        <button
          onClick={fetchWindows}
          disabled={isLoading}
          className="bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2 px-4 border border-gray-300 rounded-lg shadow-sm flex items-center justify-center transition-colors disabled:bg-gray-200 disabled:cursor-not-allowed"
          aria-label="Làm mới danh sách kỳ thi"
        >
          <RefreshIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="ml-2">Làm mới</span>
        </button>
      </div>

      {globalError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl shadow-lg flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold">Đã xảy ra lỗi</p>
            <p>{globalError}</p>
          </div>
          <button onClick={clearGlobalError} className="text-rose-800 hover:bg-rose-100 p-2 rounded-full">&times;</button>
        </div>
      )}

      {fetchError && (
        <div className="text-center bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl shadow-lg">
          <p className="text-lg font-semibold">Đã xảy ra lỗi</p>
          <p>{fetchError}</p>
        </div>
      )}

      {windows.length === 0 && !isLoading && !fetchError ? (
        <div className="text-center bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <p className="text-xl text-gray-500">Hiện tại không có kỳ thi nào dành cho bạn.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {windows.map(w => {
            const status = getWindowStatus(w.start_at, w.end_at);
            return (
              <div
                key={w.id}
                className="bg-white rounded-xl shadow-lg hover:shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-300"
              >
                <div className="p-6 flex-grow">
                  <h3 className="text-2xl font-bold text-indigo-600">{w.exam.title}</h3>
                  <p className="mt-2 text-gray-700 flex-grow">{w.exam.description}</p>
                  <div className="mt-4 text-sm text-gray-500 space-y-1">
                    <p>
                      <strong>Có sẵn cho đến:</strong> {new Date(w.end_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-gray-700">
                      <BookOpenIcon />
                      <span className="ml-2">{w.exam.totalQuestions} câu hỏi</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <ClockIcon />
                      <span className="ml-2">{w.exam.duration} phút</span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <CheckCircleIcon />
                      <span className="ml-2">Đạt từ {w.exam.pass_threshold * 100}%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nhập mã truy cập"
                      className="w-full px-3 py-2 border bg-white border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      value={accessCode[w.id] || ''}
                      onChange={e => setAccessCode(prev => ({ ...prev, [w.id]: e.target.value }))}
                    />
                    {error[w.id] && <p className="text-rose-600 text-sm">{error[w.id]}</p>}
                  </div>

                  {status.state === 'upcoming' && (
                    <div className="w-full text-center bg-sky-100 text-sky-800 font-bold py-3 px-4 rounded-lg mt-4">
                      {status.message}
                    </div>
                  )}

                  {status.state === 'expired' && (
                    <div className="w-full text-center bg-gray-100 text-gray-600 font-bold py-3 px-4 rounded-lg mt-4">
                      {status.message}
                    </div>
                  )}

                  {status.state === 'active' && (
                    <button
                      onClick={() => handleStartClick(w)}
                      disabled={!!startingWindowId || isLoading}
                      className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:bg-indigo-400 disabled:cursor-not-allowed flex justify-center items-center mt-4"
                    >
                      {startingWindowId === w.id ? <LoadingSpinner /> : 'Bắt đầu thi'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;