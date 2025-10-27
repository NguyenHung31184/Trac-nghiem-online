import React, { useMemo, useState, useEffect } from 'react';
import type { Exam, Attempt, Question, User } from '../types';
import { requestAttemptReview } from '../services/examService';
import { generateStudyNotes } from '../services/geminiService';
import { LoadingSpinner } from './icons/LoadingSpinner';
import ConfirmationModal from './admin/ConfirmationModal';

interface PrintableReportProps {
    user: User;
    exam: Exam;
    attempt: Attempt;
    questions: Question[];
}

// Component con để định dạng báo cáo khi in
const PrintableReport: React.FC<PrintableReportProps> = ({ user, exam, attempt, questions }) => {
    const results = useMemo(() => {
        let correctCount = 0;
        questions.forEach(q => {
          if (attempt.answers[q.id] === q.answer_key) {
            correctCount++;
          }
        });
        const total = questions.length;
        const score = total > 0 ? (correctCount / total) * 100 : 0;
        const passed = score >= exam.pass_threshold * 100;
        return { correctCount, total, score, passed };
    }, [attempt, questions, exam]);

    return (
        <div className="p-8 font-sans">
            <h1 className="text-3xl font-bold mb-2 text-center">BÁO CÁO KẾT QUẢ BÀI THI</h1>
            <div className="text-center mb-8 border-b pb-4">
                <p><strong>Bài thi:</strong> {exam.title}</p>
                <p><strong>Học viên:</strong> {user.name}</p>
                <p><strong>Ngày hoàn thành:</strong> {new Date(attempt.completed_at!).toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8 text-center">
                <div className="p-4 bg-gray-100 rounded">
                    <p className="text-sm font-semibold text-gray-600">KẾT QUẢ</p>
                    <p className={`text-2xl font-bold ${results.passed ? 'text-green-600' : 'text-red-600'}`}>{results.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</p>
                </div>
                <div className="p-4 bg-gray-100 rounded">
                    <p className="text-sm font-semibold text-gray-600">ĐIỂM SỐ</p>
                    <p className="text-2xl font-bold">{results.score.toFixed(1)}%</p>
                </div>
                <div className="p-4 bg-gray-100 rounded">
                    <p className="text-sm font-semibold text-gray-600">TRẢ LỜI ĐÚNG</p>
                    <p className="text-2xl font-bold">{results.correctCount} / {results.total}</p>
                </div>
            </div>

            <h2 className="text-2xl font-bold mt-8 mb-4 border-b pb-2">Chi tiết câu trả lời</h2>
            <div className="space-y-6">
                {questions.map((q, index) => {
                    const userAnswerId = attempt.answers[q.id];
                    const isCorrect = userAnswerId === q.answer_key;
                    const userAnswerText = q.options.find(o => o.id === userAnswerId)?.text;
                    const correctAnswerText = q.options.find(o => o.id === q.answer_key)?.text;

                    return (
                        <div key={q.id} className="p-4 border rounded-lg break-inside-avoid">
                            <p className="font-bold text-gray-800">Câu {index + 1}:</p>
                            <div className="prose prose-sm max-w-none mb-3" dangerouslySetInnerHTML={{ __html: q.stem }} />
                            <p className={`p-2 rounded text-sm ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                <strong>Câu trả lời của bạn: </strong> {userAnswerText || <span className="italic">Chưa trả lời</span>}
                            </p>
                            {!isCorrect && (
                                <p className="p-2 mt-2 rounded text-sm bg-green-100 text-green-800">
                                    <strong>Đáp án đúng: </strong> {correctAnswerText}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


interface ResultsPageProps {
  exam: Exam;
  attempt: Attempt;
  questions: Question[];
  onBackToDashboard: () => void;
  user: User;
}

const ResultsPage: React.FC<ResultsPageProps> = ({ user, exam, attempt, questions, onBackToDashboard }) => {
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [studyNotes, setStudyNotes] = useState<string | null>(null);
  const [reviewRequested, setReviewRequested] = useState(attempt.reviewRequested);
  const [isProcessing, setIsProcessing] = useState(true);
  
  // State for confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    // Simulate the asynchronous scoring process
    const timer = setTimeout(() => {
      setIsProcessing(false);
    }, 1500); // Simulate a 1.5 second scoring delay
    return () => clearTimeout(timer);
  }, []);
  
  const results = useMemo(() => {
    let correctCount = 0;
    const incorrectTopicsSet = new Set<string>();

    questions.forEach(q => {
      if (attempt.answers[q.id] === q.answer_key) {
        correctCount++;
      } else {
        incorrectTopicsSet.add(q.topic);
      }
    });
    
    const total = questions.length;
    const score = total > 0 ? correctCount / total : 0;
    const passed = score >= exam.pass_threshold;
    const incorrectTopics = Array.from(incorrectTopicsSet);
    if(incorrectTopics.length === 0 && !passed && total > 0) incorrectTopics.push('Ôn tập chung');
    
    attempt.score = score;

    return { correctCount, total, score, passed, incorrectTopics };
  }, [exam, attempt, questions]);

  const handleGenerateNotes = async () => {
    setIsGeneratingNotes(true);
    setStudyNotes(null);
    try {
      const notes = await generateStudyNotes(results.incorrectTopics);
      setStudyNotes(notes);
    } catch (e) {
      console.error("Lỗi khi tạo ghi chú ôn tập:", e);
      setStudyNotes("Xin lỗi, đã có lỗi khi tạo ghi chú ôn tập. Vui lòng thử lại sau.");
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const confirmRequestReview = async () => {
    try {
        await requestAttemptReview(attempt.id);
        setReviewRequested(true);
    } catch (error) {
        console.error("Lỗi khi yêu cầu xem lại:", error);
        alert("Không thể gửi yêu cầu. Vui lòng kiểm tra kết nối mạng và thử lại.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const studentScorePercent = (results.score * 100);
  const passThresholdPercent = (exam.pass_threshold * 100);

  if (isProcessing) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-4xl mx-auto text-center border border-gray-200">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Đang xử lý kết quả</h2>
        <p className="text-lg text-gray-600 mb-8">Bài làm của bạn đã được nộp thành công. Vui lòng đợi trong giây lát trong khi hệ thống chấm điểm.</p>
        <div className="flex justify-center items-center h-40">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <>
    <style>{`
        @media print {
            body * {
                visibility: hidden;
            }
            .printable-area, .printable-area * {
                visibility: visible;
            }
            .printable-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
            }
            .no-print {
                display: none;
            }
        }
    `}</style>
    <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmRequestReview}
        title="Yêu cầu xem lại"
        message={<p>Bạn có chắc chắn muốn yêu cầu xem lại kết quả theo cách thủ công không?</p>}
    />
    <div className="printable-area">
        <PrintableReport user={user} exam={exam} attempt={attempt} questions={questions} />
    </div>
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xl max-w-4xl mx-auto text-center border border-gray-200 no-print">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Kết quả bài thi</h2>
      <p className="text-lg text-gray-600 mb-6">Dành cho: {exam.title}</p>

      <div className={`inline-block px-8 py-3 rounded-full mb-6 ${results.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
        <span className="text-2xl font-bold">{results.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <p className="text-sm text-gray-500">Điểm số</p>
          <p className="text-4xl font-bold text-indigo-600">{studentScorePercent.toFixed(1)}%</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <p className="text-sm text-gray-500">Câu trả lời đúng</p>
          <p className="text-4xl font-bold text-gray-800">{results.correctCount} / {results.total}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
          <p className="text-sm text-gray-500">Điểm đạt</p>
          <p className="text-4xl font-bold text-gray-800">{passThresholdPercent}%</p>
        </div>
      </div>
      
      {/* Chart Section */}
      <div className="mb-8 pt-6 border-t border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">So sánh điểm số</h3>
        <div className="w-full bg-gray-100 rounded-lg p-4 h-64 flex justify-center items-end gap-8 sm:gap-12" aria-label="Biểu đồ so sánh điểm số">
          {/* Student's Score Bar */}
          <div className="flex flex-col items-center">
            <div
              className={`w-12 sm:w-16 rounded-t-lg transition-all duration-1000 ease-out ${results.passed ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ height: `${studentScorePercent}%` }}
              role="progressbar"
              aria-valuenow={studentScorePercent}
              aria-valuemin={0}
              aria-valuemax={100}
            ></div>
            <p className="mt-2 text-sm font-semibold text-gray-800">Điểm của bạn</p>
            <p className="text-xs text-gray-500">{studentScorePercent.toFixed(1)}%</p>
          </div>

          {/* Passing Score Bar */}
          <div className="flex flex-col items-center">
             <div
              className="w-12 sm:w-16 bg-gray-300 rounded-t-lg transition-all duration-1000 ease-out"
              style={{ height: `${passThresholdPercent}%` }}
              role="progressbar"
              aria-valuenow={passThresholdPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            ></div>
            <p className="mt-2 text-sm font-semibold text-gray-800">Điểm đạt</p>
            <p className="text-xs text-gray-500">{passThresholdPercent.toFixed(1)}%</p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={onBackToDashboard}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
        >
          Về trang chủ
        </button>
        
        <button
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={reviewRequested}
            className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors border border-gray-300 disabled:bg-gray-200 disabled:cursor-not-allowed"
        >
            {reviewRequested ? 'Đã yêu cầu xem lại' : 'Yêu cầu xem lại'}
        </button>
        
        <button
            onClick={handlePrint}
            className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-3 px-6 rounded-lg transition-colors border border-gray-300"
        >
            📄 In báo cáo
        </button>

        {results.incorrectTopics.length > 0 && (
          <button
            onClick={handleGenerateNotes}
            disabled={isGeneratingNotes}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-purple-400"
          >
            {isGeneratingNotes ? <LoadingSpinner /> : '✨ Tạo ghi chú ôn tập bằng AI'}
          </button>
        )}
      </div>

      {studyNotes && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg text-left border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Hướng dẫn ôn tập cá nhân của bạn</h3>
            <div className="prose prose-indigo max-w-none" dangerouslySetInnerHTML={{ __html: studyNotes }}></div>
        </div>
      )}
    </div>
    </>
  );
};

export default ResultsPage;
