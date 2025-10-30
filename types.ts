export interface User {
  id: string;
  name: string;
  email: string;
  roles?: string[]; // ví dụ: ['admin', 'teacher', 'student']
  role?: string; // Một số luồng vẫn sử dụng khóa đơn lẻ
  classIds?: string[];
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
  variants?: number; // Số biến thể mong muốn sinh ra cho mỗi lần đồng bộ
  questionsSnapshotUrl?: string; // URL đến file JSON câu hỏi tĩnh (kiến trúc cũ)
  // Blueprint được giữ lại cho Admin UI để xác định cách tạo bài thi từ QBank
  blueprint?: { topic: string; difficulty: string; count: number }[] | string;
  // Các thuộc tính đồng bộ biến thể được Cloud Function cập nhật
  snapshotVariantIds?: string[];
  isSynced?: boolean;
  lastSyncedAt?: { seconds: number; nanoseconds: number } | null;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  updatedAt?: { seconds: number; nanoseconds: number } | null;
  // FIX: Add optional questions property for exam snapshots.
  questions?: Question[];
}

export interface ExamVariantSnapshot {
  id: string;
  examId: string;
  examTitle: string;
  variant: number;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  duration?: number;
  totalPoints: number;
  questions: Question[];
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
  // Thêm các thuộc tính khác của AuditLog nếu cần
}

export interface QuestionWithExamDetails extends Question {
  examId?: string;
  examTitle?: string;
}

export interface AttemptWithDetails extends Attempt {
  exam?: Exam;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  window?: ExamWindow;
  userName?: string;
  examTitle?: string;
  className?: string;
}