import React, { useState, useCallback, useEffect } from 'react';
import type { User, Exam, Attempt, ExamWindow, AuditLog, Question } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import ExamView from './components/ExamView';
import ResultsPage from './components/ResultsPage';
import Header from './components/Header';
import { LoadingSpinner } from './components/icons/LoadingSpinner';
import ProctoringReport from './components/admin/ProctoringReport';
import { fetchQuestionsFromSnapshot, getUserProfile, getExamVariantForStudent } from './services/examService';
import { auth } from './services/firebase';
import { onAuthStateChanged } from "firebase/auth";


type View = 'login' | 'dashboard' | 'exam' | 'results' | 'admin' | 'proctor_report';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('login');
  const [selectedWindow, setSelectedWindow] = useState<ExamWindow | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<Attempt | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportAttemptId, setReportAttemptId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string>('');


  useEffect(() => {
    // Lắng nghe sự thay đổi trạng thái xác thực của Firebase
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            try {
                // Lấy token của người dùng để kiểm tra vai trò (custom claims)
                const idTokenResult = await firebaseUser.getIdTokenResult();
                const isAdmin = idTokenResult.claims.role === 'admin';
                
                let appUser: User;
                if (isAdmin) {
                    // Nếu là admin, tạo đối tượng user với vai trò admin
                    appUser = {
                        id: firebaseUser.uid,
                        name: firebaseUser.displayName || firebaseUser.email!,
                        email: firebaseUser.email!,
                        role: 'admin',
                    };
                } else {
                    // Nếu là học sinh, lấy thông tin hồ sơ từ backend (GAS)
                    const profile = await getUserProfile(firebaseUser.email!);
                    appUser = {
                        id: firebaseUser.uid,
                        name: profile.name, // Sử dụng tên từ backend
                        email: profile.email,
                        role: 'student',
                        classIds: profile.classIds, // Sử dụng danh sách lớp từ backend
                    };
                }
                setUser(appUser);
                setCurrentView(appUser.role === 'student' ? 'dashboard' : 'admin');
            } catch (error) {
                console.error("Không thể lấy hồ sơ người dùng:", error);
                // Có thể người dùng đã xác thực nhưng chưa có trong danh sách học viên
                alert("Tài khoản của bạn chưa được gán vào lớp học nào hoặc có lỗi khi xác thực. Vui lòng liên hệ quản trị viên.");
                await auth.signOut(); // Đăng xuất người dùng
            }
        } else {
            // Người dùng đã đăng xuất
            setUser(null);
            setCurrentView('login');
        }
        setIsLoading(false);
    });

    // Dọn dẹp listener khi component bị unmount
    return () => unsubscribe();
  }, []);

  const handleLogout = useCallback(async () => {
    await auth.signOut();
    setUser(null);
    setSelectedWindow(null);
    setSelectedExam(null);
    setActiveAttempt(null);
    setExamQuestions([]);
    setGlobalError('');
    setCurrentView('login');
  }, []);

  const handleStartExam = useCallback(async (exam: Exam, window: ExamWindow, attempt: Attempt) => {
    setIsLoading(true);
    setGlobalError('');
    try {
        // Bước 1: Lấy URL biến thể đề thi dành riêng cho sinh viên
        if (!user || !user.email) {
            throw new Error("Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.");
        }
        
        const variantData = await getExamVariantForStudent(exam.id, user.email);
        if (!variantData || !variantData.url) {
            throw new Error("Không thể lấy được biến thể đề thi. Vui lòng liên hệ quản trị viên.");
        }
        
        // Bước 2: Tải câu hỏi từ URL biến thể đã nhận được
        const questions = await fetchQuestionsFromSnapshot(variantData.url);
        if (questions.length === 0) {
            throw new Error("Không thể tải câu hỏi từ URL được cung cấp. File có thể trống hoặc không hợp lệ.");
        }

        setExamQuestions(questions);
        setSelectedExam(exam);
        setSelectedWindow(window);
        setActiveAttempt(attempt);
        setCurrentView('exam');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Lỗi khi bắt đầu bài thi:", errorMessage);
        setGlobalError(`Không thể bắt đầu bài thi: ${errorMessage}`);
        // Quay lại dashboard nếu có lỗi
        setCurrentView('dashboard');
    } finally {
        setIsLoading(false);
    }
  }, [user]);

  const handleSubmitExam = useCallback((finalAttempt: Attempt) => {
    setActiveAttempt(finalAttempt);
    setCurrentView('results');
  }, []);

  const handleBackToDashboard = useCallback(() => {
    setSelectedWindow(null);
    setSelectedExam(null);
    setActiveAttempt(null);
    setExamQuestions([]);
    setGlobalError('');
    if (user?.role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('dashboard');
    }
  }, [user]);
  
  const handleViewProctoringReport = useCallback((attemptId: string) => {
    setReportAttemptId(attemptId);
    setCurrentView('proctor_report');
  }, []);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <LoadingSpinner />
        </div>
      );
    }

    if (!user) {
      return <Login />;
    }

    switch (currentView) {
      case 'admin':
        return <AdminDashboard onViewProctoringReport={handleViewProctoringReport} />;
      case 'proctor_report':
        if(reportAttemptId) {
            return <ProctoringReport attemptId={reportAttemptId} onBack={handleBackToDashboard} />
        }
        // Fallback
        setCurrentView('admin');
        return null;
      case 'dashboard':
        return <Dashboard user={user} onStartExam={handleStartExam} globalError={globalError} clearGlobalError={() => setGlobalError('')} />;
      case 'exam':
        if (selectedExam && activeAttempt && examQuestions.length > 0) {
          return <ExamView exam={selectedExam} attempt={activeAttempt} questions={examQuestions} onSubmit={handleSubmitExam} />;
        }
        // Fallback to dashboard if something is wrong
        setCurrentView('dashboard');
        return null;
      case 'results':
        if (user && selectedExam && activeAttempt) {
            // Ưu tiên sử dụng danh sách câu hỏi đã xáo trộn từ 'activeAttempt' nếu có.
            // Nếu không, sử dụng danh sách câu hỏi gốc.
            const questionsForResults = activeAttempt.questions || examQuestions;
            if (questionsForResults.length > 0) {
                return <ResultsPage user={user} exam={selectedExam} attempt={activeAttempt} questions={questionsForResults} onBackToDashboard={handleBackToDashboard} />;
            }
        }
        // Fallback to dashboard
        setCurrentView('dashboard');
        return null;
      default:
        return <Login />;
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen font-sans text-gray-800">
      {user && <Header user={user} onLogout={handleLogout} />}
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default App;
