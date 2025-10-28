import React, { useState, useEffect, useMemo } from 'react';
import type { QuestionWithExamDetails, Exam } from '../../types';
import { getAdminDashboardData, addQuestion, updateQuestion } from '../../services/examService';
import { generateQuestion } from '../../services/geminiService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { convertToDirectGoogleDriveLink } from '../../utils/imageUtils';
import ImageModal from '../ImageModal'; // Đảm bảo bạn đã có ImageModal component

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialQuestion: QuestionWithExamDetails | null;
}

type QuestionOption = { id: string; text: string };

type QuestionFormData = {
  examId: string;
  stem: string;
  options: QuestionOption[];
  answer_key: string;
  topic: string;
  difficulty: string; // Đã thay đổi thành string để linh hoạt hơn
  imageUrl?: string;
};

// Kiểu dữ liệu mở rộng để xử lý các định dạng câu hỏi cũ hoặc không nhất quán
type LegacyQuestionShape = QuestionWithExamDetails & {
  questionText?: string;
  correctAnswer?: string;
  options?: (QuestionOption | string)[]; // Cho phép options là mảng string hoặc QuestionOption
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
};

const DEFAULT_OPTION_COUNT = 4;

// Hàm tạo các lựa chọn trống mặc định
const createEmptyOptions = (): QuestionOption[] =>
  Array.from({ length: DEFAULT_OPTION_COUNT }, (_, index) => ({
    id: `opt-${index + 1}`,
    text: '',
  }));

// Hàm đảm bảo giá trị là string và loại bỏ khoảng trắng
const coerceOptionText = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object' && value !== null && 'text' in (value as any)) {
    return coerceOptionText((value as any).text);
  }

  return String(value);
};

// Hàm chuẩn hóa dữ liệu câu hỏi từ nhiều định dạng sang QuestionFormData
const normalizeQuestionForForm = (
  question: LegacyQuestionShape | null,
  fallbackExamId: string
): QuestionFormData => {
  if (!question) {
    return {
      examId: fallbackExamId,
      stem: '',
      options: createEmptyOptions(),
      answer_key: '',
      topic: '',
      difficulty: DEFAULT_DIFFICULTY_SUGGESTIONS[0] || '', // Mặc định độ khó đầu tiên
      imageUrl: '',
    };
  }

  const rawOptions = Array.isArray(question.options) ? question.options : [];
  let normalizedOptions: QuestionOption[] = [];
  let normalizedAnswerKey = question.answer_key || '';

  const optionCandidates: string[] = [];

  // Ưu tiên định dạng { id, text }
  if (
    rawOptions.length > 0 &&
    typeof rawOptions[0] === 'object' &&
    rawOptions[0] !== null &&
    'text' in (rawOptions[0] as any)
  ) {
    normalizedOptions = (rawOptions as QuestionOption[]).map((opt, index) => ({
      id: opt.id || `opt-${index + 1}`, // Đảm bảo mỗi option có id
      text: coerceOptionText(opt.text),
    }));
  } else if (rawOptions.length > 0) {
    // Nếu options là mảng string
    optionCandidates.push(
      ...(rawOptions as unknown[])
        .map(value => coerceOptionText(value))
        .filter(candidate => candidate !== '')
    );
  }

  // Xử lý các options kiểu cũ (optionA, optionB, ...)
  if (!optionCandidates.length) {
    const legacyOptionValues = [
      question.optionA ?? question.option1,
      question.optionB ?? question.option2,
      question.optionC ?? question.option3,
      question.optionD ?? question.option4,
    ];

    optionCandidates.push(
      ...legacyOptionValues
        .map(value => coerceOptionText(value))
        .filter(candidate => candidate !== '')
    );
  }

  // Nếu vẫn chưa có options nào, tạo từ candidates
  if (!normalizedOptions.length && optionCandidates.length) {
    normalizedOptions = optionCandidates.map((text, index) => ({
      id: `opt-${index + 1}`,
      text,
    }));
  }

  // Nếu vẫn không có options, tạo options trống mặc định
  if (!normalizedOptions.length) {
    normalizedOptions = createEmptyOptions();
  }

  // Chuẩn hóa answer_key: đảm bảo nó là ID của một option hiện có
  if (normalizedAnswerKey) {
    const hasMatchingId = normalizedOptions.some(opt => opt.id === normalizedAnswerKey);
    if (!hasMatchingId) {
      // Nếu answer_key không phải ID, thử tìm theo text
      const answerFromOptions = normalizedOptions.find(opt => opt.text.trim() === normalizedAnswerKey.trim());
      if (answerFromOptions) {
        normalizedAnswerKey = answerFromOptions.id;
      } else {
        // Nếu không tìm thấy, reset answer_key
        normalizedAnswerKey = '';
      }
    }
  }

  // Xử lý correctAnswer cũ (nếu answer_key chưa được thiết lập)
  if (!normalizedAnswerKey && typeof question.correctAnswer === 'string') {
    const normalizedCorrect = question.correctAnswer.trim();
    const matched = normalizedOptions.find(
      opt => opt.text.trim() === normalizedCorrect
    );
    if (matched) {
      normalizedAnswerKey = matched.id;
    }
  }

  return {
    examId: question.examId || fallbackExamId,
    stem: coerceOptionText(question.stem || question.questionText),
    options: normalizedOptions,
    answer_key: normalizedAnswerKey,
    topic: question.topic ? coerceOptionText(question.topic) : '',
    difficulty: question.difficulty
      ? coerceOptionText(question.difficulty)
      : DEFAULT_DIFFICULTY_SUGGESTIONS[0] || '',
    imageUrl: question.imageUrl ? coerceOptionText(question.imageUrl) : '',
  };
};

// Các gợi ý độ khó mặc định
const DEFAULT_DIFFICULTY_SUGGESTIONS = [
  'Bậc 1-2',
  'Bậc 2-3',
  'Bậc 3-4',
  'Bậc 4-5',
  'Bậc 5-6',
  'easy',
  'medium',
  'hard',
];

const QuestionFormModal: React.FC<QuestionFormModalProps> = ({ isOpen, onClose, onSave, initialQuestion }) => {
  // Sử dụng normalizeQuestionForForm ngay khi khởi tạo state
  const [formData, setFormData] = useState<QuestionFormData>(() =>
    normalizeQuestionForForm(initialQuestion, initialQuestion?.examId || '')
  );
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false); // Thêm state để xử lý lỗi tải ảnh preview

  // Cập nhật formData khi initialQuestion hoặc exams thay đổi
  useEffect(() => {
    // Giá trị examId mặc định nếu initialQuestion không có
    const fallbackExamId = initialQuestion?.examId || (exams[0]?.id ?? '');
    setFormData(normalizeQuestionForForm(initialQuestion, fallbackExamId));
  }, [initialQuestion, isOpen, exams]);

  // Tải danh sách bài thi khi modal mở
  useEffect(() => {
    const fetchExams = async () => {
      const data = await getAdminDashboardData();
      const examList = data.exams;
      setExams(examList);
      if (!initialQuestion && examList.length > 0) {
        // Nếu là tạo câu hỏi mới và chưa có examId, đặt mặc định là exam đầu tiên
        setFormData(prev => ({...prev, examId: examList[0].id}));
      }
    };
    if (isOpen) {
        fetchExams();
    }
  }, [initialQuestion, isOpen]); // Thêm initialQuestion vào dependencies

  // Xử lý thay đổi input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); // Xóa lỗi khi người dùng bắt đầu chỉnh sửa
    if (name === 'imageUrl') {
      setPreviewLoadFailed(false); // Reset lỗi tải ảnh khi URL thay đổi
    }
  };
  
  // Xử lý thay đổi option text
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index].text = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };
  
  // Thêm option mới
  const addOption = () => {
      setFormData(prev => ({ ...prev, options: [...prev.options, {id: `opt-${Date.now()}`, text: ''}] }));
  };

  // Xóa option
  const removeOption = (index: number) => {
      const newOptions = formData.options.filter((_, i) => i !== index);
      // Nếu đáp án đúng bị xóa, reset answer_key
      if (formData.answer_key === formData.options[index].id) {
          setFormData(prev => ({ ...prev, options: newOptions, answer_key: '' }));
      } else {
          setFormData(prev => ({ ...prev, options: newOptions }));
      }
  };

  // Gợi ý độ khó động: bao gồm độ khó hiện tại và các gợi ý mặc định
  const difficultySuggestions = useMemo(() => {
    const deduped = new Set<string>();
    if (formData.difficulty) {
      deduped.add(formData.difficulty);
    }
    DEFAULT_DIFFICULTY_SUGGESTIONS.forEach(option => deduped.add(option));
    return Array.from(deduped);
  }, [formData.difficulty]);

  // Xử lý tạo câu hỏi bằng AI
  const handleGenerateWithAI = async () => {
    if (!formData.topic || formData.topic.trim() === '') {
        setError("Vui lòng nhập chủ đề trước khi tạo bằng AI.");
        return;
    }
    setIsGenerating(true);
    setError('');
    try {
        // Chuẩn hóa độ khó sang định dạng mà Gemini API hỗ trợ
        const normalizedDifficulty: 'easy' | 'medium' | 'hard' =
          formData.difficulty === 'easy' || formData.difficulty === 'medium' || formData.difficulty === 'hard'
            ? (formData.difficulty as 'easy' | 'medium' | 'hard')
            : 'medium'; // Mặc định là 'medium' nếu không khớp

        if (normalizedDifficulty === 'medium' && formData.difficulty !== 'medium') {
          console.warn(
            `AI generator chỉ hỗ trợ các mức "easy", "medium" hoặc "hard". Đang sử dụng mặc định "medium" cho độ khó "${formData.difficulty}".`
          );
        }

        const result = await generateQuestion(formData.topic, normalizedDifficulty);
        if (result) {
            const newOptions = result.options.map((text, i) => ({ id: `opt-gen-${i}`, text }));
            setFormData(prev => ({
                ...prev,
                stem: result.stem,
                options: newOptions,
                answer_key: newOptions[result.answerIndex]?.id || '',
            }));
        } else {
            setError("AI không thể tạo câu hỏi hợp lệ. Vui lòng thử lại.");
        }
    } catch (e) {
        console.error("Lỗi khi tạo câu hỏi bằng AI:", e);
        setError("Đã xảy ra lỗi khi giao tiếp với AI. Vui lòng kiểm tra console để biết thêm chi tiết.");
    } finally {
        setIsGenerating(false);
    }
  };

  // Mở modal xem trước hình ảnh
  const openPreviewModal = (url: string) => {
    setPreviewImageUrl(url);
    setIsPreviewOpen(true);
  };

  // Xử lý nút xem trước hình ảnh
  const handlePreviewImage = () => {
    if (!formData.imageUrl || !formData.imageUrl.trim()) {
      setError('Vui lòng nhập URL hình ảnh trước khi xem trước.');
      return;
    }

    const normalizedUrl = convertToDirectGoogleDriveLink(formData.imageUrl.trim());
    if (!normalizedUrl) {
      setError('Không thể chuyển đổi URL hình ảnh. Vui lòng kiểm tra lại liên kết Google Drive.');
      return;
    }

    setError('');
    setPreviewLoadFailed(false); // Reset lỗi tải ảnh
    openPreviewModal(normalizedUrl);
  };
  
  // Xử lý submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Chuẩn hóa và lọc các lựa chọn trống
    const trimmedOptions = formData.options
      .map((opt, index) => ({
        id: opt.id || `opt-${index + 1}`, // Đảm bảo option có ID
        text: opt.text.trim(),
      }))
      .filter(opt => opt.text !== '');

    if (trimmedOptions.length < 2) {
      setError('Vui lòng nhập tối thiểu hai lựa chọn khác nhau.');
      return;
    }

    // Đảm bảo answer_key trỏ đến một option hợp lệ
    const selectedAnswer = trimmedOptions.find(opt => opt.id === formData.answer_key);
    if (!selectedAnswer) {
        setError('Vui lòng chọn một câu trả lời đúng từ các lựa chọn đã nhập.');
        return;
    }

    setIsLoading(true);
    setError('');
    
    try {
        // Tạo payload cho câu hỏi, đảm bảo tương thích với backend
        const questionPayload = {
            stem: formData.stem.trim(),
            questionText: formData.stem.trim(), // `questionText` thường được sử dụng cho hiển thị.
            options: trimmedOptions.map(opt => opt.text), // Backend có thể mong đợi mảng string
            correctAnswer: selectedAnswer.text, // Text của đáp án đúng
            answer_key: selectedAnswer.id, // ID của đáp án đúng
            topic: formData.topic.trim(),
            difficulty: formData.difficulty.trim(),
            imageUrl: formData.imageUrl?.trim() || '',
            points: initialQuestion?.points || 1, // Giữ nguyên điểm nếu sửa, hoặc mặc định là 1
        };
        
        if (initialQuestion) {
            // Cập nhật câu hỏi hiện có
            await updateQuestion({
              ...initialQuestion,
              ...questionPayload,
            } as QuestionWithExamDetails); // Ép kiểu để đảm bảo type an toàn
        } else {
            // Thêm câu hỏi mới
            await addQuestion(formData.examId, questionPayload as any); // Sử dụng `any` nếu type Question chưa hoàn toàn khớp với payload
        }
        onSave(); // Gọi hàm onSave để refresh danh sách câu hỏi
    } catch(err) {
        console.error("Failed to save question", err);
        setError('Đã xảy ra lỗi khi lưu. Vui lòng thử lại.');
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;
  
  // Chuyển đổi URL Google Drive thành direct link để hiển thị
  const directImageUrl = convertToDirectGoogleDriveLink(formData.imageUrl);
  const inputClasses = "block w-full rounded-lg border-0 py-2 px-3 bg-white text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6";
  const labelClasses = "block text-sm font-medium leading-6 text-gray-900";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {initialQuestion ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                 <div>
                      <label htmlFor="topic" className={labelClasses}>Chủ đề</label>
                      <div className="mt-2">
                         <input id="topic" name="topic" type="text" value={formData.topic} onChange={handleInputChange} className={inputClasses} required placeholder="ví dụ: React Hooks" />
                      </div>
                 </div>
                 <div>
                     <label htmlFor="difficulty" className={labelClasses}>Độ khó</label>
                     <div className="mt-2">
                        <input
                          id="difficulty"
                          name="difficulty"
                          type="text"
                          value={formData.difficulty}
                          onChange={handleInputChange}
                          className={inputClasses}
                          list="difficulty-suggestions" // Kết nối với datalist
                          placeholder="Ví dụ: Bậc 1-2"
                          required
                        />
                        <datalist id="difficulty-suggestions">
                          {difficultySuggestions.map(option => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                    </div>
                 </div>
            </div>

            <div>
                <button type="button" onClick={handleGenerateWithAI} disabled={isGenerating || !formData.topic.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center disabled:bg-indigo-400 transition-colors shadow-sm">
                    {isGenerating ? <LoadingSpinner /> : '✨ Tạo bằng AI'}
                </button>
            </div>

            <div>
                <label htmlFor="stem" className={labelClasses}>Nội dung câu hỏi (cho phép HTML)</label>
                 <div className="mt-2">
                    <textarea id="stem" name="stem" value={formData.stem} onChange={handleInputChange} rows={4} className={inputClasses} required/>
                </div>
            </div>
            <div>
                <label htmlFor="imageUrl" className={labelClasses}>URL hình ảnh (tùy chọn)</label>
                <div className="mt-2 flex gap-3">
                    <input
                      id="imageUrl"
                      name="imageUrl"
                      type="text"
                      value={formData.imageUrl}
                      onChange={handleInputChange}
                      className={`${inputClasses} flex-1`}
                      placeholder="Dán liên kết hình ảnh từ Google Drive..."
                    />
                    <button
                      type="button"
                      onClick={handlePreviewImage}
                      className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-600 hover:text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-semibold"
                      disabled={!formData.imageUrl?.trim()}
                    >
                      Xem trước
                    </button>
                </div>
                {directImageUrl && !previewLoadFailed && (
                    <button
                      type="button"
                      onClick={() => openPreviewModal(directImageUrl)}
                      className="mt-3 p-2 border rounded-lg bg-gray-50 inline-block hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <img
                          src={directImageUrl}
                          alt="Xem trước"
                          className="max-h-40 w-auto rounded"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onLoad={() => setPreviewLoadFailed(false)} // Nếu tải thành công, reset lỗi
                          onError={() => setPreviewLoadFailed(true)} // Nếu tải lỗi, set trạng thái lỗi
                        />
                    </button>
                )}
                {previewLoadFailed && (
                    <p className="mt-2 text-sm text-rose-600">Không thể tải hình ảnh xem trước. Hãy kiểm tra quyền chia sẻ hoặc URL.</p>
                )}
            </div>
             <div>
                <label className={labelClasses}>Các lựa chọn & Đáp án đúng</label>
                <p className="text-xs text-gray-500 mt-1">Chọn nút radio cho câu trả lời đúng.</p>
                <div className="space-y-3 mt-3">
                    {formData.options.map((opt, index) => (
                        <div key={opt.id} className="flex items-center space-x-3">
                           <input type="radio" name="answer_key" value={opt.id} checked={formData.answer_key === opt.id} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"/>
                           <input type="text" value={opt.text} onChange={(e) => handleOptionChange(index, e.target.value)} className={`flex-grow ${inputClasses}`} placeholder={`Lựa chọn ${index+1}`} />
                           <button type="button" onClick={() => removeOption(index)} disabled={formData.options.length <= 2} className="text-rose-500 hover:text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-xl" aria-label="Xóa lựa chọn">&times;</button>
                        </div>
                    ))}
                </div>
                 <button type="button" onClick={addOption} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 mt-3">+ Thêm lựa chọn</button>
             </div>
            
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button type="button" onClick={onClose} className="bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 font-bold py-2 px-4 rounded-lg transition-colors text-sm">Hủy</button>
                <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-indigo-400 transition-colors shadow-sm text-sm">
                    {isLoading ? <LoadingSpinner /> : 'Lưu câu hỏi'}
                </button>
            </div>
        </form>
      </div>
      {isPreviewOpen && previewImageUrl && (
        <ImageModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          imageUrl={previewImageUrl}
        />
      )}
    </div>
  );
};

export default QuestionFormModal;