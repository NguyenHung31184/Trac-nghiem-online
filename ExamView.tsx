import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Exam, Attempt, Question, AuditLog } from './types';
import { saveAnswer, submitAttempt, logAuditEvent } from './services/examService';
import { AUTOSAVE_INTERVAL_MS, PHOTO_PROCTOR_INTERVALS } from './constants';
import useTimer from './hooks/useTimer';
import useProctoring from './hooks/useProctoring';
import QuestionCard from './components/QuestionCard';
import TimerDisplay from './components/TimerDisplay';
import ProctoringModal from './components/ProctoringModal';
import { LoadingSpinner } from './components/icons/LoadingSpinner';

interface ExamViewProps {
  exam: Exam;
  attempt: Attempt;
  questions: Question[];
  onSubmit: (finalAttempt: Attempt) => void;
}

const ExamView: React.FC<ExamViewProps> = ({ exam, attempt, questions, onSubmit }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{[questionId: string]: string}>(attempt.answers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProctoringModal, setShowProctoringModal] = useState(false);
  const [proctoringReason, setProctoringReason] = useState('');
  
  const attemptRef = useRef(attempt);
  attemptRef.current = { ...attempt, answers };
  
  const proctoringChecksDone = useRef<number[]>([]);

  const handleFinalSubmit = useCallback(async (reason: string) => {
    setIsSubmitting(true);
    console.log(`Nộp bài vì: ${reason}`);
    try {
        const finalAttempt = await submitAttempt(attemptRef.current);
        onSubmit(finalAttempt);
    } catch(e) {
        console.error("Failed to submit", e);
        alert("Đã có lỗi khi nộp bài thi của bạn. Vui lòng kiểm tra kết nối.");
        setIsSubmitting(false);
    }
  }, [onSubmit]);

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
  }, [attempt.id]);

  const { requestFullScreen, isFullScreen } = useProctoring(handleProctoringEvent);

  useEffect(() => {
    startTimer();
    requestFullScreen();
    setShowProctoringModal(true);
    setProctoringReason('Xác minh danh tính ban đầu');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);
  
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
            await saveAnswer(attemptRef.current.id, attemptRef.current.answers);
            console.log('Đã tự động lưu câu trả lời');
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

  return (
    <div className="flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
      {showProctoringModal && <ProctoringModal reason={proctoringReason} onDone={handleProctoringModalClose} onPhotoTaken={(data) => handleProctoringEvent('photo_taken', {size: data.length})} />}
      
      {/* Question Panel */}
      <div className="flex-grow bg-white p-4 sm:p-8 rounded-xl shadow-xl border border-gray-200">
        {questions.length > 0 && (
          <QuestionCard
            question={questions[currentQuestionIndex]}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={questions.length}
            selectedOption={answers[questions[currentQuestionIndex].id]}
            onAnswer={handleAnswerChange}
          />
        )}
      </div>

      {/* Control Panel */}
      <div className="w-full md:w-80 lg:w-96 flex-shrink-0">
        <div className="sticky top-24 bg-white p-4 sm:p-6 rounded-xl shadow-xl border border-gray-200 space-y-6">
          <TimerDisplay timeLeft={timeLeft} />
          
          <div>
            <h4 className="font-bold text-lg mb-3 text-gray-900">Điều hướng</h4>
            <div className="overflow-x-auto pb-2">
                <div className="grid grid-flow-col auto-cols-max gap-2 sm:grid sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5">
                    {questions.map((q, index) => (
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

          <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <button 
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                Câu trước
            </button>
            {currentQuestionIndex === questions.length - 1 ? (
                <button
                    onClick={() => {
                      if (window.confirm("Bạn có chắc chắn muốn nộp bài thi không?")) {
                          handleFinalSubmit('Người dùng nộp bài');
                      }
                    }}
                    disabled={isSubmitting}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-rose-400 transition-colors"
                >
                    {isSubmitting ? <LoadingSpinner /> : 'Nộp bài'}
                </button>
            ) : (
                <button 
                    onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                    disabled={currentQuestionIndex === questions.length - 1}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Câu sau
                </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamView;