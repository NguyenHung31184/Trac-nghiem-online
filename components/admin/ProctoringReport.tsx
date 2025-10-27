import React, { useState, useEffect } from 'react';
import type { AuditLog } from '../../types';
import { getAttemptAuditLogs } from '../../services/examService';
import { summarizeAuditLogs } from '../../services/geminiService';
import { LoadingSpinner } from '../icons/LoadingSpinner';

interface ProctoringReportProps {
  attemptId: string;
  onBack: () => void;
}

const eventStyles = {
    focus_lost: { icon: '⚠️', label: 'Mất tập trung', color: 'text-yellow-600' },
    visibility_hidden: { icon: '⛔️', label: 'Chuyển Tab', color: 'text-red-600' },
    copy_paste_blocked: { icon: '📄', label: 'Chặn sao chép/dán', color: 'text-orange-600' },
    photo_taken: { icon: '📸', label: 'Đã chụp ảnh danh tính', color: 'text-blue-600' },
};


const ProctoringReport: React.FC<ProctoringReportProps> = ({ attemptId, onBack }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!attemptId) return;
      setIsLoading(true);
      // Hàm này giờ đây sẽ gọi đến Firestore
      const fetchedLogs = await getAttemptAuditLogs(attemptId);
      setLogs(fetchedLogs);
      setIsLoading(false);
    };
    fetchLogs();
  }, [attemptId]);
  
  const handleSummarize = async () => {
    setIsSummarizing(true);
    const result = await summarizeAuditLogs(logs);
    setSummary(result);
    setIsSummarizing(false);
  };

  return (
    <div>
        <div className="flex justify-between items-center mb-6">
            <div>
                <button onClick={onBack} className="text-indigo-600 hover:underline mb-2">&larr; Quay lại kết quả</button>
                <h2 className="text-3xl font-bold text-gray-900">Báo cáo giám sát</h2>
                <p className="text-gray-600">Hiển thị nhật ký hoạt động cho lần thử: {attemptId}</p>
            </div>
            <button
                onClick={handleSummarize}
                disabled={isSummarizing || logs.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-purple-300 transition-colors"
            >
                {isSummarizing ? <LoadingSpinner /> : '✨ Tóm tắt bằng AI'}
            </button>
        </div>
      
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner /> <span className="ml-3">Đang tải nhật ký...</span>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="font-bold text-xl mb-4 text-gray-900">Nhật ký sự kiện</h3>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                        {logs.length > 0 ? logs.map(log => {
                            const style = eventStyles[log.event] || {icon: '🔹', label: log.event, color: 'text-gray-600'};
                            return (
                                <div key={log.id} className="flex items-start p-2 bg-gray-100 rounded-md">
                                    <span className="text-xl mr-3">{style.icon}</span>
                                    <div>
                                        <p className={`font-semibold ${style.color}`}>{style.label}</p>
                                        <p className="text-sm text-gray-500">{new Date(log.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                            )
                        }) : <p className="text-gray-500 text-center py-8">Không có sự kiện giám sát nào được ghi lại cho lần thử này.</p>}
                    </div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="font-bold text-xl mb-4 text-gray-900">Tóm tắt bởi AI</h3>
                     {summary ? (
                        <div className="prose prose-indigo max-w-none" dangerouslySetInnerHTML={{ __html: summary }}></div>
                     ) : (
                        <p className="text-gray-500 text-center py-8">
                            {isSummarizing ? 'Đang tạo tóm tắt...' : 'Nhấp vào nút "Tóm tắt bằng AI" để tạo phân tích các sự kiện.'}
                        </p>
                     )}
                </div>
            </div>
        )}

    </div>
  );
};

export default ProctoringReport;
