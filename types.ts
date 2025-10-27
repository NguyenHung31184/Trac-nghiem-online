export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'admin' | 'proctor';
  classIds?: string[]; // Gán học viên vào một hoặc nhiều lớp
}

export interface Class {
  id: string;
  name: string;
}

export interface Question {
  id: string;
  stem: string; // Nội dung câu hỏi, ánh xạ từ cột "Câu hỏi"
  options: { id: string; text: string }[]; // Các lựa chọn từ "Đáp án A", "B", "C", "D"
  answer_key: string; // ID của lựa chọn đúng, được suy ra từ correctAnswer
  points: number; // Điểm của câu hỏi, từ cột "Points"
  topic: string; // Chủ đề/Ngành, từ cột "Lớp/Ngành"
  difficulty: string; // Bậc thi/Độ khó, từ cột "Bậc"
  mandatoryLevel?: string; // Cấp độ bắt buộc của câu hỏi, từ cột "mandatory level"
  imageUrl?: string; // URL ảnh minh họa đã được chuyển đổi, từ cột "Image Link"
  analytics?: { pValue: number }; // Cho bảng điều khiển phân tích
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  duration: number; // tính bằng phút
  pass_threshold: number; // ví dụ: 0.7 cho 70%
  totalQuestions: number; // Tổng số câu hỏi sẽ được lấy từ QBank
  questionsSnapshotUrl?: string; // URL đến file JSON câu hỏi tĩnh
  // Blueprint được giữ lại cho Admin UI để xác định cách tạo bài thi từ QBank
  blueprint?: { topic: string; difficulty: string; count: number }[] | string;
  // FIX: Add optional questions property for exam snapshots.
  questions?: Question[];
}

export interface ExamWindow {
    id: string;
    examId: string;
    classId: string; // Gán ca thi cho lớp nào
    start_at: number; // timestamp
    end_at: number; // timestamp
    accessCode: string;
}

export interface Attempt {
  id: string;
  userId: string;
  examId: string;
  windowId: string;
  status: 'in-progress' | 'completed';
  answers: { [questionId: string]: string }; // { qid: optionId } - optionId là id của lựa chọn
  score: number | null;
  started_at: number; // timestamp
  completed_at: number | null; // timestamp
  reviewRequested: boolean;
  questions?: Question[]; // Optional: To carry questions data to the results page
}

export interface AuditLog {
  id:string;
  attemptId: string;
  event: 'focus_lost' | 'visibility_hidden' | 'copy_paste_blocked' | 'photo_taken';
  timestamp: number;
  metadata?: { [key: string]: any };
}

export interface AttemptWithDetails extends Attempt {
    userName: string;
    examTitle: string;
    className: string;
}

// Giữ lại để tương thích với các component admin
export interface QuestionWithExamDetails extends Question {
    examId: string;
    examTitle: string;
    // Được thêm vào từ Code.gs để hiển thị câu hỏi này được dùng ở đâu
    usedInExams?: { examId: string; examTitle: string }[];
}