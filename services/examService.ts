import type { Exam, Question, Attempt, AuditLog, User, AttemptWithDetails, QuestionWithExamDetails, Class, ExamWindow } from '../types';
import { db } from './firebase';
import { 
    doc, 
    setDoc, 
    updateDoc, 
    addDoc, 
    collection, 
    serverTimestamp,
    getDocs,
    query,
    orderBy
} from "firebase/firestore";

// !!! QUAN TRỌNG: DÁN URL TRIỂN KHAI GOOGLE APPS SCRIPT WEB APP CỦA BẠN VÀO ĐÂY
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyx2bI-f1PuEyqH__5PVkHgfFWcT-jPBc9eVtHHrLP2SirC_oYep1K2xIie1IFXqOsTOA/exec';

// =================================================================================
// ========================== API HELPER FOR GOOGLE APPS SCRIPT ====================
// =================================================================================

async function gasApiRequest<T>(action: string, method: 'GET' | 'POST' = 'GET', body: object = {}): Promise<T> {
  if (SCRIPT_URL.includes('PASTE_YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_URL_HERE')) {
    const errorMsg = `LỖI CẤU HÌNH: Vui lòng dán URL triển khai Google Apps Script của bạn vào biến SCRIPT_URL trong file services/examService.ts.`;
    throw new Error(errorMsg);
  }
  
  const url = new URL(SCRIPT_URL);
  // Luôn gửi action trong URL để tương thích với backend GAS.
  url.searchParams.append('action', action);
  
  const options: RequestInit = {
      method,
      headers: {},
      mode: 'cors'
  };

  if (method === 'GET') {
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
        }
      }
  } else if (method === 'POST') {
      // Đối với POST, action đã có trong URL, chỉ cần gửi dữ liệu trong body.
      options.body = JSON.stringify(body);
      options.headers = { 'Content-Type': 'text/plain;charset=utf-8' }; // GAS doPost đọc nội dung dạng text
  }
  
  try {
    const response = await fetch(url.toString(), options);
    const textResponse = await response.text();
    try {
        const result = JSON.parse(textResponse);
        if (!result.ok) {
            // Đây là lỗi ứng dụng từ logic GAS của chúng ta (ví dụ: "Invalid action")
            throw new Error(result.error || 'Lỗi không xác định từ Google Apps Script');
        }
        return result.data as T;
    } catch (jsonError) {
        // Điều này có nghĩa là GAS đã trả về một thứ không phải JSON, như trang lỗi HTML
        console.error("Failed to parse JSON response:", textResponse);
        throw new Error("Phản hồi không hợp lệ từ máy chủ quản trị. Có thể triển khai GAS đã gặp lỗi.");
    }
  } catch (error: any) {
    // Bắt cả lỗi mạng và lỗi ứng dụng được ném ở trên.
    console.error(`[GAS API] Lỗi hành động "${action}":`, error);
    // Ném lại lỗi ban đầu để các thành phần UI có thể hiển thị một thông báo cụ thể
    throw error;
  }
}

// =================================================================================
// ======================== TẢI DỮ LIỆU TĨNH "HOT PATH" ============================
// =================================================================================

export const fetchQuestionsFromSnapshot = async (url: string): Promise<Question[]> => {
    if (!url) {
        console.error("fetchQuestionsFromSnapshot called with no URL.");
        return [];
    }
    try {
        // GAS Drive URLs need a little tweak to be direct download links
        const downloadUrl = url.replace('/view?usp=drivesdk', '&export=download');
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const snapshotData: { questions?: Question[] } = await response.json();
        return snapshotData.questions || [];
    } catch (error) {
        console.error("Failed to fetch or parse question snapshot:", error);
        // Ném lại lỗi để UI có thể xử lý
        throw new Error(`Không thể tải hoặc phân tích file câu hỏi từ URL: ${url}. Lỗi gốc: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// =================================================================================
// ========================== FIREBASE "HOT PATH" FUNCTIONS ========================
// =================================================================================

export const createAttempt = async (userId: string, examId: string, windowId: string): Promise<Attempt> => {
    const attemptId = `atm_${Date.now()}`;
    const newAttempt: Attempt = {
        id: attemptId,
        userId,
        examId,
        windowId,
        status: 'in-progress',
        answers: {},
        score: null,
        started_at: Date.now(),
        completed_at: null,
        reviewRequested: false
    };
    
    const attemptRef = doc(db, 'attempts', attemptId);
    await setDoc(attemptRef, { ...newAttempt, started_at: serverTimestamp() });
    
    return newAttempt;
};

export const saveAnswer = async (attemptId: string, answers: { [questionId: string]: string }): Promise<void> => {
    const attemptRef = doc(db, "attempts", attemptId);
    await updateDoc(attemptRef, {
        answers: answers
    });
};

export const submitAttempt = async (attempt: Attempt): Promise<Attempt> => {
    const attemptRef = doc(db, "attempts", attempt.id);
    const finalAttemptData = {
        ...attempt,
        status: 'completed' as const,
        completed_at: Date.now(),
    };
    
    await updateDoc(attemptRef, {
        status: 'completed',
        completed_at: serverTimestamp(),
        answers: attempt.answers,
        score: attempt.score,
        questions: attempt.questions || [] // Đảm bảo lưu cả câu hỏi đã xáo trộn
    });
    
    return finalAttemptData;
};

export const logAuditEvent = async (log: Omit<AuditLog, 'id'>): Promise<void> => {
    const logsCollectionRef = collection(db, `attempts/${log.attemptId}/audit_logs`);
    const dataToSave: { [key: string]: any } = {
        ...log,
        timestamp: serverTimestamp()
    };
    if (dataToSave.metadata === undefined) {
        delete dataToSave.metadata;
    }
    await addDoc(logsCollectionRef, dataToSave);
};

export const requestAttemptReview = async (attemptId: string): Promise<void> => {
    const attemptRef = doc(db, "attempts", attemptId);
    await updateDoc(attemptRef, {
        reviewRequested: true
    });
};

// =================================================================================
// ======================== GOOGLE APPS SCRIPT "COLD PATH" FUNCTIONS ===============
// =================================================================================

export type UserProfile = {
    name: string;
    email: string;
    classIds: string[];
}
export const getUserProfile = (email: string): Promise<UserProfile> => {
    return gasApiRequest('getUserProfileByEmail', 'GET', { email });
};

export const getAvailableWindowsForUser = (user: User): Promise<(ExamWindow & {exam: Exam})[]> => {
    return gasApiRequest('getAvailableWindowsForUser', 'GET', { email: user.email });
};

export type ExamVariant = {
  examId: string;
  variant: number;
  url: string;
}

export const getExamVariantForStudent = (examId: string, studentEmail: string): Promise<ExamVariant> => {
    return gasApiRequest('getExamVariantForStudent', 'POST', { examId, studentEmail });
};


// --- Các hàm cho Admin ---

type AdminDashboardData = {
    students: User[];
    questions: QuestionWithExamDetails[];
    exams: Exam[];
    windows: ExamWindow[];
    classes: Class[];
    qbankCount: number;
};

export const getAdminDashboardData = (): Promise<AdminDashboardData> => {
    return gasApiRequest('getAdminDashboardData', 'GET');
};

export const addClass = (className: string): Promise<Class> => {
    return gasApiRequest('addClass', 'POST', { className });
};

export const updateClass = (classData: Class): Promise<void> => {
    return gasApiRequest('updateClass', 'POST', { classData });
};

export const addExam = (exam: Omit<Exam, 'id'>): Promise<Exam> => {
    return gasApiRequest('addExam', 'POST', { exam });
};

export const updateExam = (exam: Exam): Promise<void> => {
    return gasApiRequest('updateExam', 'POST', { exam });
};

export const deleteExam = (examId: string): Promise<void> => {
    return gasApiRequest('deleteExam', 'POST', { examId });
};

export const addWindow = (windowData: Omit<ExamWindow, 'id'>): Promise<ExamWindow> => {
    return gasApiRequest('addWindow', 'POST', { windowData });
};

export const addQuestion = (examId: string, question: Omit<Question, 'id' | 'analytics'>): Promise<Question> => {
    return gasApiRequest('addQuestion', 'POST', { examId, question });
};

export const updateQuestion = (question: QuestionWithExamDetails): Promise<void> => {
    return gasApiRequest('updateQuestion', 'POST', { question });
};

export const deleteQuestion = (questionId: string): Promise<void> => {
    return gasApiRequest('deleteQuestion', 'POST', { questionId });
};

export type ExamAnalyticsData = {
    questionAnalytics: Question[];
};

export const getExamAnalytics = (examId: string): Promise<ExamAnalyticsData> => {
    return gasApiRequest('getExamAnalytics', 'GET', { examId });
};

export const getAllAttemptsFromFirestore = async (): Promise<Attempt[]> => {
    const attemptsCollection = collection(db, 'attempts');
    const q = query(attemptsCollection, orderBy('started_at', 'desc'));
    const snapshot = await getDocs(q);
    
    const attempts: Attempt[] = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        attempts.push({
            ...data,
            id: doc.id,
            started_at: data.started_at?.toMillis() || 0,
            completed_at: data.completed_at?.toMillis() || null,
        } as Attempt);
    });
    return attempts;
};

export const getAttemptAuditLogs = async (attemptId: string): Promise<AuditLog[]> => {
    const logsCollection = collection(db, `attempts/${attemptId}/audit_logs`);
    const q = query(logsCollection, orderBy('timestamp', 'asc'));
    const snapshot = await getDocs(q);
    
    const logs: AuditLog[] = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        logs.push({
            ...data,
            id: doc.id,
            timestamp: data.timestamp?.toMillis() || 0,
        } as AuditLog);
    });
    return logs;
};

// Hàm mới để kích hoạt đồng bộ từ frontend
export type SyncResult = {
    successes: { examId: string; examTitle: string; totalQuestions: number }[];
    failures: { examId: string; examTitle: string; error: string }[];
}
export const runSyncAndCreateSnapshots = (): Promise<{
  successes: { examId: string; examTitle: string; snapshotUrl: string; totalQuestions: number }[],
  failures: { examId: string; examTitle: string; error: string }[]
}> => {
  return gasApiRequest('syncAndCreateSnapshots', 'POST', { numVariants: 10 });
};