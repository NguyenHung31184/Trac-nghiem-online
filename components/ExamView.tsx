import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Exam, Attempt, Question, AuditLog } from '../types';
import { saveAnswer, submitAttempt, logAuditEvent } from '../services/examService';
import { AUTOSAVE_INTERVAL_MS, PHOTO_PROCTOR_INTERVALS, MAX_VIOLATIONS } from '../constants';
import useTimer from '../hooks/useTimer';
import useProctoring from '../hooks/useProctoring';
import QuestionCard from './QuestionCard';
import TimerDisplay from './TimerDisplay';
import ProctoringModal from './ProctoringModal';
import { LoadingSpinner } from './icons/LoadingSpinner';
import ViolationWarningModal from './ViolationWarningModal';
import ConfirmationModal from './admin/ConfirmationModal';

interface ExamViewProps {
  exam: Exam;
  attempt: Attempt;
  questions: Question[];
  onSubmit: (finalAttempt: Attempt) => void;
}

const ShufflingLoader: React.FC = () => (
    <div className="flex justify-center items-center h-[50vh]">
      <LoadingSpinner />
      <p className="ml-4 text-lg text-gray-600">Đang xáo trộn câu hỏi...</p>
    </div>
);

const AutosaveStatus: React.FC<{ status: 'idle' | 'saving' | 'success' | 'error' }> = ({ status }) => {
    switch (status) {
        case 'saving':
            return <div className="flex items-center text-sm text-gray-500"><LoadingSpinner /> <span className="ml-2">Đang lưu...</span></div>;
        case 'success':
            return <div className="text-sm text-emerald-600">✓ Đã lưu tất cả thay đổi.</div>;
        case 'error':
            return <div className="text-sm text-rose-600">⚠️ Lỗi khi lưu. Hãy kiểm tra kết nối mạng.</div>;
        default:
            return <div className="text-sm text-gray-500">Thay đổi sẽ được tự động lưu.</div>;
    }
};

const ExamView: React.FC<ExamViewProps> = ({ exam, attempt, questions, onSubmit }) => {
  // TỐI ƯU HÓA: Chuyển logic xáo trộn nặng vào hàm khởi tạo của useState.
  // Điều này đảm bảo nó chỉ chạy MỘT LẦN khi component được tạo.
  const [shuffledQuestions] = useState(() => {
    if (!questions || questions.length === 0) {
      return [];
    }

    const shuffleArray = <T,>(array: T[]): T[] => {
      const newArray = [...array];
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
    };

    // Deep copy để tránh thay đổi prop gốc
    const questionsToShuffle: Question[] = JSON.parse(JSON.stringify(questions));

    // Xáo trộn các lựa chọn trong mỗi câu hỏi
    questionsToShuffle.forEach((question) => {
      if (question.options) {
        question.options = shuffleArray(question.options);
      }
    });

    // Xáo trộn thứ tự các câu hỏi
    return shuffleArray(questionsToShuffle);
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{[questionId: string]: string}>(attempt.answers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProctoringModal, setShowProctoringModal] = useState(false);
  const [proctoringReason, setProctoringReason] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  
  const violationCountRef = useRef(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [lastViolationCount, setLastViolationCount] = useState(0);

  // State for submission confirmation modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const attemptRef = useRef(attempt);
  attemptRef.current = { ...attempt, answers };
  
  const proctoringChecksDone = useRef<number[]>([]);

  const handleFinalSubmit = useCallback(async (reason: string) => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    console.log(`Nộp bài vì: ${reason}`);
    try {
        let correctCount = 0;
        shuffledQuestions.forEach(q => {
            if (answers[q.id] === q.answer_key) {
                correctCount++;
            }
        });
        const totalQuestions = shuffledQuestions.length;
        const score = totalQuestions > 0 ? (correctCount / totalQuestions) : 0;

        const gradedAttempt = {
            ...attemptRef.current,
            score: score,
            questions: shuffledQuestions, // Đính kèm câu hỏi đã xáo trộn
        };
        
        const finalAttempt = await submitAttempt(gradedAttempt);
        onSubmit(finalAttempt);
    } catch(e) {
        console.error("Failed to submit", e);
        alert("Đã có lỗi khi nộp bài thi của bạn. Vui lòng kiểm tra kết nối.");
        setIsSubmitting(false);
    }
  }, [onSubmit, isSubmitting, shuffledQuestions, answers]);

  const handleTimeUp = useCallback(() => {
    if(!isSubmitting) {
      handleFinalSubmit('Hết giờ');
    }
  }, [isSubmitting, handleFinalSubmit]);

  const { timeLeft, startTimer } = useTimer(exam.duration * 60, handleTimeUp);

  const handleProctoringEvent = useCallback(async (event: AuditLog['event'], metadata?: object) => {
    console.warn(`Proctoring event: ${event}`, metadata || '');
    await logAuditEvent({
        attemptId: attempt.id,
        event,
        timestamp: Date.now(),
        metadata
    });

    if (event === 'focus_lost' || event === 'visibility_hidden') {
        violationCountRef.current += 1;
        const newViolationCount = violationCountRef.current;
        setLastViolationCount(newViolationCount);
        setShowViolationWarning(true);

        if (newViolationCount >= MAX_VIOLATIONS) {
            setTimeout(() => handleFinalSubmit('Vượt quá số lần vi phạm cho phép'), 3000);
        }
    }
  }, [attempt.id, handleFinalSubmit]);

  const { requestFullScreen, isFullScreen } = useProctoring(handleProctoringEvent);

  useEffect(() => {
    startTimer();
    requestFullScreen();
    setShowProctoringModal(true);
    setProctoringReason('Xác minh danh tính ban đầu');
  }, [exam.id, startTimer, requestFullScreen]);
  
  useEffect(() => {
      const totalDuration = exam.duration * 60;
      const elapsedTime = totalDuration - timeLeft;
      const progress = elapsedTime / totalDuration;

      PHOTO_PROCTOR_INTERVALS.forEach((checkPoint, index) => {
          if (progress >= checkPoint && !proctoringChecksDone.current.includes(index)) {
              proctoringChecksDone.current.push(index);
              setShowProctoringModal(true);
              setProctoringReason(`Kiểm tra danh tính tại ${Math.round(checkPoint * 100)}% tiến độ`);
          }
      });

  }, [timeLeft, exam.duration]);

  useEffect(() => {
    const interval = setInterval(async () => {
        if (Object.keys(attemptRef.current.answers).length > 0) {
            setAutosaveStatus('saving');
            try {
                await saveAnswer(attemptRef.current.id, attemptRef.current.answers);
                setAutosaveStatus('success');
                setTimeout(() => setAutosaveStatus('idle'), 3000);
            } catch (error) {
                console.error("Lỗi tự động lưu:", error);
                setAutosaveStatus('error');
            }
        }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleAnswerChange = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };
  
  const handleProctoringModalClose = () => {
      setShowProctoringModal(false);
      setProctoringReason('');
  }
  
  if (!isFullScreen) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 text-white p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Yêu cầu toàn màn hình</h2>
            <p className="text-lg mb-8 max-w-2xl">Vì mục đích giám sát, bài thi này phải được thực hiện ở chế độ toàn màn hình. Điều này giúp đảm bảo một môi trường thi công bằng.</p>
            <button
                onClick={requestFullScreen}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg text-xl"
            >
                Vào chế độ toàn màn hình
            </button>
        </div>
    );
  }
  
  if (shuffledQuestions.length === 0) {
    return <ShufflingLoader />;
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={() => handleFinalSubmit('Người dùng nộp bài')}
        title="Xác nhận nộp bài"
        message={<p>Bạn có chắc chắn muốn nộp bài thi không? Hành động này không thể hoàn tác.</p>}
      />
      <ViolationWarningModal
        isOpen={showViolationWarning}
        onClose={() => setShowViolationWarning(false)}
        violationCount={lastViolationCount}
        maxViolations={MAX_VIOLATIONS}
      />
      
      {showProctoringModal && <ProctoringModal reason={proctoringReason} onDone={handleProctoringModalClose} onPhotoTaken={(data) => handleProctoringEvent('photo_taken', {size: data.length})} />}
      
      <div className="flex-grow bg-white p-4 sm:p-8 rounded-xl shadow-xl border border-gray-200">
        <QuestionCard
          question={shuffledQuestions[currentQuestionIndex]}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={shuffledQuestions.length}
          selectedOption={answers[shuffledQuestions[currentQuestionIndex].id]}
          onAnswer={handleAnswerChange}
        />
      </div>

      <div className="w-full md:w-80 lg:w-96 flex-shrink-0">
        <div className="sticky top-24 bg-white p-4 sm:p-6 rounded-xl shadow-xl border border-gray-200 space-y-6">
          <TimerDisplay timeLeft={timeLeft} />
          
          <div>
            <h4 className="font-bold text-lg mb-3 text-gray-900">Điều hướng</h4>
            <div className="overflow-x-auto pb-2">
                <div className="grid grid-flow-col auto-cols-max gap-2 sm:grid sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5">
                    {shuffledQuestions.map((q, index) => (
                        <button 
                            key={q.id}
                            onClick={() => setCurrentQuestionIndex(index)}
                            aria-label={`Đi đến câu ${index + 1}`}
                            className={`h-10 w-10 rounded-full flex items-center justify-center font-bold transition-colors flex-shrink-0 text-sm border-2 border-transparent ${
                                index === currentQuestionIndex 
                                    ? 'bg-indigo-600 text-white ring-2 ring-offset-2 ring-indigo-500' 
                                    : answers[q.id]
                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200'
                                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                            }`}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200 space-y-4">
              <div className="flex justify-between items-center">
                <button 
                    onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentQuestionIndex === 0}
                    className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Câu trước
                </button>
                {currentQuestionIndex === shuffledQuestions.length - 1 ? (
                    <button
                        onClick={() => setIsConfirmModalOpen(true)}
                        disabled={isSubmitting}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-rose-400 transition-colors"
                    >
                        {isSubmitting ? <LoadingSpinner /> : 'Nộp bài'}
                    </button>
                ) : (
                    <button 
                        onClick={() => setCurrentQuestionIndex(prev => Math.min(shuffledQuestions.length - 1, prev + 1))}
                        disabled={currentQuestionIndex === shuffledQuestions.length - 1}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Câu sau
                    </button>
                )}
              </div>
               <div className="text-center h-5">
                 <AutosaveStatus status={autosaveStatus} />
               </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamView;