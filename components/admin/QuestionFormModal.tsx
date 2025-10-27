import React, { useState, useEffect } from 'react';
import type { QuestionWithExamDetails, Exam, Question } from '../../types';
// FIX: Replaced missing 'getAvailableExams' with 'getAdminDashboardData'.
import { getAdminDashboardData, addQuestion, updateQuestion } from '../../services/examService';
import { generateQuestion } from '../../services/geminiService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { convertToDirectGoogleDriveLink } from '../../utils/imageUtils';

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialQuestion: QuestionWithExamDetails | null;
}

type QuestionFormData = {
  examId: string;
  stem: string;
  options: { id: string; text: string }[];
  answer_key: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  imageUrl?: string;
};

const QuestionFormModal: React.FC<QuestionFormModalProps> = ({ isOpen, onClose, onSave, initialQuestion }) => {
  const [formData, setFormData] = useState<QuestionFormData>({
    examId: initialQuestion?.examId || '',
    stem: initialQuestion?.stem || '',
    options: initialQuestion?.options?.length ? initialQuestion.options : [{id: 'opt-1', text: ''}, {id: 'opt-2', text: ''}, {id: 'opt-3', text: ''}, {id: 'opt-4', text: ''}],
    answer_key: initialQuestion?.answer_key || '',
    topic: initialQuestion?.topic || '',
    difficulty: initialQuestion?.difficulty || 'medium',
    imageUrl: initialQuestion?.imageUrl || '',
  });
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialQuestion) {
        setFormData({
            examId: initialQuestion.examId || '',
            stem: initialQuestion.stem || '',
            options: initialQuestion.options?.length ? initialQuestion.options : [{id: 'opt-1', text: ''}, {id: 'opt-2', text: ''}, {id: 'opt-3', text: ''}, {id: 'opt-4', text: ''}],
            answer_key: initialQuestion.answer_key || '',
            topic: initialQuestion.topic || '',
            difficulty: initialQuestion.difficulty || 'medium',
            imageUrl: initialQuestion.imageUrl || '',
        });
    } else {
        // Reset form for new question
         setFormData({
            examId: exams.length > 0 ? exams[0].id : '',
            stem: '',
            options: [{id: 'opt-1', text: ''}, {id: 'opt-2', text: ''}, {id: 'opt-3', text: ''}, {id: 'opt-4', text: ''}],
            answer_key: '',
            topic: '',
            difficulty: 'medium',
            imageUrl: '',
        });
    }
  }, [initialQuestion, isOpen, exams]);

  useEffect(() => {
    const fetchExams = async () => {
      // FIX: Call getAdminDashboardData and extract the 'exams' array.
      const data = await getAdminDashboardData();
      const examList = data.exams;
      setExams(examList);
      if (!initialQuestion && examList.length > 0) {
        setFormData(prev => ({...prev, examId: examList[0].id}));
      }
    };
    if (isOpen) {
        fetchExams();
    }
  }, [initialQuestion, isOpen]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index].text = value;
    setFormData(prev => ({ ...prev, options: newOptions }));
  };
  
  const addOption = () => {
      setFormData(prev => ({ ...prev, options: [...prev.options, {id: `opt-${Date.now()}`, text: ''}] }));
  };

  const removeOption = (index: number) => {
      const newOptions = formData.options.filter((_, i) => i !== index);
      if (formData.answer_key === formData.options[index].id) {
          setFormData(prev => ({ ...prev, options: newOptions, answer_key: '' }));
      } else {
          setFormData(prev => ({ ...prev, options: newOptions }));
      }
  };

  const handleGenerateWithAI = async () => {
    if (!formData.topic) {
        setError("Vui lòng nhập chủ đề trước khi tạo bằng AI.");
        return;
    }
    setIsGenerating(true);
    setError('');
    try {
        const result = await generateQuestion(formData.topic, formData.difficulty as 'easy'|'medium'|'hard');
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
        setError("Đã xảy ra lỗi khi giao tiếp với AI.");
    } finally {
        setIsGenerating(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.answer_key) {
        setError('Vui lòng chọn một câu trả lời đúng.');
        return;
    }
    setIsLoading(true);
    setError('');
    
    try {
        // FIX: Removed non-existent 'correctAnswer' from Omit<> type.
        const questionPayload: Omit<Question, 'id' | 'analytics' | 'points'> & { points?: number } = {
            stem: formData.stem,
            options: formData.options.filter(opt => opt.text.trim() !== ''),
            answer_key: formData.answer_key,
            topic: formData.topic,
            difficulty: formData.difficulty,
            imageUrl: formData.imageUrl,
            points: initialQuestion?.points || 1,
        };
        
        if (initialQuestion) {
            // FIX: Removed non-existent 'correctAnswer' property from the update payload.
            await updateQuestion({...initialQuestion, ...questionPayload});
        } else {
            await addQuestion(formData.examId, questionPayload as Omit<Question, 'id' | 'analytics'>);
        }
        onSave();
    } catch(err) {
        console.error("Failed to save question", err);
        setError('Đã xảy ra lỗi khi lưu. Vui lòng thử lại.');
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;
  
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
                        <select id="difficulty" name="difficulty" value={formData.difficulty} onChange={handleInputChange} className={inputClasses} required>
                            <option value="easy">Dễ</option>
                            <option value="medium">Trung bình</option>
                            <option value="hard">Khó</option>
                        </select>
                    </div>
                </div>
            </div>

            <div>
                <button type="button" onClick={handleGenerateWithAI} disabled={isGenerating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg flex items-center justify-center disabled:bg-indigo-400 transition-colors shadow-sm">
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
                <div className="mt-2">
                    <input id="imageUrl" name="imageUrl" type="text" value={formData.imageUrl} onChange={handleInputChange} className={inputClasses} placeholder="Dán liên kết hình ảnh từ Google Drive..."/>
                </div>
                {directImageUrl && (
                    <div className="mt-3 p-2 border rounded-lg bg-gray-50 inline-block">
                        <img src={directImageUrl} alt="Xem trước" className="max-h-40 w-auto rounded" />
                    </div>
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
    </div>
  );
};

export default QuestionFormModal;