import React, { useState, useEffect, useCallback } from 'react';
import type { User, Exam, Attempt, ExamWindow } from '../types';
import { createAttempt, getAvailableWindowsForUser } from '../services/examService';
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
  const isExamReady = useCallback((exam: Exam) => {
    if (!exam) {
      return false;
    }
    if (Array.isArray(exam.snapshotVariantIds) && exam.snapshotVariantIds.length > 0) {
      return true;
    }
    return Boolean(exam.questionsSnapshotUrl);
  }, []);

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
      setFetchError('Không thể tải danh sách kỳ thi. Vui lòng thử lại.');
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

    if ((accessCode[window.id] || '').trim() !== (window.accessCode || '').trim()) {
      setError(prev => ({ ...prev, [window.id]: 'Mã truy cập không hợp lệ.' }));
      return;
    }
    if (!isExamReady(window.exam)) {
      setError(prev => ({ ...prev, [window.id]: 'Bài thi này chưa sẵn sàng. Vui lòng liên hệ quản trị viên để đồng bộ biến thể.' }));
      return;
    }
    const status = getWindowStatus(window.start_at, window.end_at);
    if (status.state !== 'active') {
      setError(prev => ({ ...prev, [window.id]: status.message }));
      return;
    }

    setStartingWindowId(window.id);
    try {
      const newAttempt = await createAttempt(user.id, window.examId, window.id);
      onStartExam(window.exam, window, newAttempt);
    } catch (err) {
      console.error('Failed to create attempt:', err);
      alert('Không thể bắt đầu bài thi. Vui lòng thử lại.');
      setStartingWindowId(null);
    }
  };

  if (isLoading && windows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <LoadingSpinner />
        <p className="mt-4 text-lg font-medium text-gray-600">Đang tải các kỳ thi...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-y-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Chào mừng, {user.name}!</h1>
          <p className="mt-2 text-lg text-gray-600">Các kỳ thi của bạn được liệt kê bên dưới.</p>
        </div>
        <button
          onClick={fetchWindows}
          disabled={isLoading}
          className="transition-all duration-300 flex items-center justify-center gap-2 text-sm font-semibold bg-white border border-gray-200 shadow-sm px-5 py-2.5 rounded-xl hover:shadow-md hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Làm mới danh sách kỳ thi"
        >
          <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {globalError && (
          <div className="bg-red-50 border-l-4 border-red-400 text-red-800 p-4 rounded-lg flex justify-between items-start" role="alert">
            <div>
                <p className="font-bold">Đã xảy ra lỗi</p>
                <p>{globalError}</p>
            </div>
            <button onClick={clearGlobalError} className="font-bold text-2xl -mt-2 -mr-1">&times;</button>
          </div>
      )}

      {fetchError && (
        <div className="text-center bg-red-50 border border-red-200 text-red-800 p-6 rounded-2xl shadow-lg">
          <p className="text-xl font-bold">Lỗi</p>
          <p className="mt-2">{fetchError}</p>
        </div>
      )}

      {windows.length === 0 && !isLoading && !fetchError ? (
        <div className="text-center bg-white p-12 rounded-3xl shadow-lg border border-gray-200">
          <p className="text-2xl font-semibold text-gray-700">Tuyệt vời!</p>
          <p className="mt-2 text-lg text-gray-500">Hiện tại không có kỳ thi nào dành cho bạn.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {windows.map(w => {
            const status = getWindowStatus(w.start_at, w.end_at);
            return (
              <div
                key={w.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-xl border border-gray-200/80 overflow-hidden flex flex-col transition-all duration-300 ease-in-out hover:-translate-y-1"
              >
                <div className="p-6 flex-grow">
                  <h3 className="text-xl font-bold text-indigo-700">{w.exam.title}</h3>
                  <p className="mt-3 text-gray-600 flex-grow text-sm">{w.exam.description}</p>
                  <div className="mt-4 text-xs text-gray-500 space-y-1.5">
                    <p>
                      <strong>Hạn chót:</strong> {new Date(w.end_at).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-5 bg-gray-50/70 border-t border-gray-200/80">
                  <div className="grid grid-cols-3 gap-x-4 mb-6 text-center">
                    <div className="flex flex-col items-center text-gray-700">
                      <BookOpenIcon className="h-5 w-5 mb-1"/>
                      <span className="text-sm font-medium">{w.exam.totalQuestions} câu</span>
                    </div>
                    <div className="flex flex-col items-center text-gray-700">
                      <ClockIcon className="h-5 w-5 mb-1"/>
                      <span className="text-sm font-medium">{w.exam.duration} phút</span>
                    </div>
                    <div className="flex flex-col items-center text-gray-700">
                      <CheckCircleIcon className="h-5 w-5 mb-1"/>
                      <span className="text-sm font-medium">Đạt {w.exam.pass_threshold * 100}%</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Mã truy cập"
                      className="transition w-full px-4 py-2.5 border bg-white border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                      value={accessCode[w.id] || ''}
                      onChange={e => setAccessCode(prev => ({ ...prev, [w.id]: e.target.value }))}
                    />
                    {error[w.id] && <p className="text-red-600 text-sm font-medium px-1">{error[w.id]}</p>}
                  </div>

                  {status.state === 'upcoming' && (
                    <div className="w-full text-center bg-sky-100 text-sky-800 font-semibold py-3 px-4 rounded-lg mt-4 text-sm">
                      {status.message}
                    </div>
                  )}

                  {status.state === 'expired' && (
                    <div className="w-full text-center bg-gray-200 text-gray-600 font-semibold py-3 px-4 rounded-lg mt-4 text-sm">
                      {status.message}
                    </div>
                  )}

                  {status.state === 'active' && (
                    <button
                      onClick={() => handleStartClick(w)}
                      disabled={!!startingWindowId || isLoading}
                      className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 disabled:bg-indigo-400 disabled:cursor-not-allowed flex justify-center items-center mt-4"
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
