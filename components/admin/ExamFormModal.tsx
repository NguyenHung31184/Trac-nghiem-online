import React, { useState, useEffect } from 'react';
import type { Exam } from '../../types';
import { addExam, updateExam } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { TrashIcon } from '../icons/TrashIcon';

interface ExamFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialExam: Exam | null;
  allTopics: string[];
  allDifficulties: string[];
}

type BlueprintRule = {
    topic: string;
    difficulty: string;
    count: number;
};

const ExamFormModal: React.FC<ExamFormModalProps> = ({ isOpen, onClose, onSave, initialExam, allTopics, allDifficulties }) => {
  const [formData, setFormData] = useState<Omit<Exam, 'id' | 'totalQuestions' | 'questionsSnapshotUrl' | 'questions' | 'blueprint'> & { blueprint?: BlueprintRule[] }>({
    title: '',
    description: '',
    duration: 60,
    pass_threshold: 0.7,
    blueprint: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    if (initialExam) {
        let blueprintRules: BlueprintRule[] = [];
        if (typeof initialExam.blueprint === 'string' && initialExam.blueprint.trim().startsWith('[')) {
            try {
                blueprintRules = JSON.parse(initialExam.blueprint);
            } catch {
                blueprintRules = []; // Lỗi, để trống
            }
        } else if (Array.isArray(initialExam.blueprint)) {
            blueprintRules = initialExam.blueprint;
        }

        setFormData({
            title: initialExam.title,
            description: initialExam.description,
            duration: initialExam.duration,
            pass_threshold: initialExam.pass_threshold,
            blueprint: blueprintRules,
        });
    } else {
        setFormData({
            title: '',
            description: '',
            duration: 60,
            pass_threshold: 0.7,
            blueprint: [{ topic: allTopics[0] || '', difficulty: allDifficulties[0] || 'medium', count: 1 }],
        });
    }
  }, [initialExam, isOpen, allTopics, allDifficulties]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'duration' || name === 'pass_threshold' ? parseFloat(value) : value }));
  };

  const handleBlueprintChange = (index: number, field: keyof BlueprintRule, value: string | number) => {
    const newBlueprint = [...(formData.blueprint || [])];
    const rule = { ...newBlueprint[index] };
    (rule[field] as any) = field === 'count' ? parseInt(value as string, 10) : value;
    newBlueprint[index] = rule;
    setFormData(prev => ({ ...prev, blueprint: newBlueprint }));
  };

  const addBlueprintRule = () => {
    const newRule: BlueprintRule = { topic: allTopics[0] || '', difficulty: allDifficulties[0] || 'medium', count: 1 };
    setFormData(prev => ({ ...prev, blueprint: [...(prev.blueprint || []), newRule] }));
  };

  const removeBlueprintRule = (index: number) => {
    setFormData(prev => ({ ...prev, blueprint: (prev.blueprint || []).filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const examData = {
        ...formData,
        totalQuestions: (formData.blueprint || []).reduce((sum, rule) => sum + (rule.count || 0), 0),
        blueprint: JSON.stringify(formData.blueprint || []),
      };

      if (initialExam) {
        const payload = { ...initialExam, ...examData };
        await updateExam(payload);
      } else {
        await addExam(examData as Omit<Exam, 'id'>);
      }
      onSave();
    } catch (err: any) {
      console.error("Failed to save exam", err);
      setError(`Lưu bài thi thất bại: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;
  
  const inputClasses = "block w-full rounded-lg border-0 py-2 px-3 bg-white text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6";
  const labelClasses = "block text-sm font-medium leading-6 text-gray-900";


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {initialExam ? 'Sửa bài thi' : 'Tạo bài thi mới'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          
          <div>
            <label htmlFor="title" className={labelClasses}>Tiêu đề bài thi</label>
            <div className="mt-2">
              <input id="title" name="title" type="text" value={formData.title} onChange={handleInputChange} className={inputClasses} required />
            </div>
          </div>
          
          <div>
            <label htmlFor="description" className={labelClasses}>Mô tả</label>
            <div className="mt-2">
              <textarea id="description" name="description" value={formData.description} onChange={handleInputChange} rows={3} className={inputClasses} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="duration" className={labelClasses}>Thời gian (phút)</label>
              <div className="mt-2">
                <input id="duration" name="duration" type="number" value={formData.duration} onChange={handleInputChange} className={inputClasses} required min="1" />
              </div>
            </div>
            <div>
              <label htmlFor="pass_threshold" className={labelClasses}>Ngưỡng đạt (0.0 - 1.0)</label>
              <div className="mt-2">
                <input id="pass_threshold" name="pass_threshold" type="number" value={formData.pass_threshold} onChange={handleInputChange} className={inputClasses} required min="0" max="1" step="0.01" />
              </div>
            </div>
          </div>
          
          {/* Blueprint Builder */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Ma trận đề thi</h3>
            <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              {(formData.blueprint || []).map((rule, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-8 gap-3 items-center">
                  <div className="md:col-span-3">
                    <label className="text-xs text-gray-600">Chủ đề</label>
                    <select value={rule.topic} onChange={(e) => handleBlueprintChange(index, 'topic', e.target.value)} className={inputClasses}>
                      {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Độ khó</label>
                    <select value={rule.difficulty} onChange={(e) => handleBlueprintChange(index, 'difficulty', e.target.value)} className={inputClasses}>
                      {allDifficulties.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Số lượng</label>
                    <input type="number" value={rule.count} onChange={(e) => handleBlueprintChange(index, 'count', e.target.value)} className={inputClasses} min="1"/>
                  </div>
                  <div className="md:col-span-1 self-end">
                    <button type="button" onClick={() => removeBlueprintRule(index)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-gray-200 rounded-full transition-colors" title="Xóa quy tắc"><TrashIcon/></button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addBlueprintRule}
                className="mt-3 bg-white hover:bg-gray-100 text-indigo-600 font-semibold py-2 px-3 border border-indigo-200 rounded-lg flex items-center text-sm"
              >
                <PlusCircleIcon />
                <span className="ml-2">Thêm quy tắc</span>
              </button>
            </div>
             <p className="text-sm text-gray-600 mt-2">Tổng số câu hỏi: <span className="font-bold">{(formData.blueprint || []).reduce((sum, rule) => sum + (rule.count || 0), 0)}</span></p>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button type="button" onClick={onClose} className="bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 font-bold py-2 px-4 rounded-lg transition-colors text-sm">Hủy</button>
            <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-indigo-400 transition-colors shadow-sm text-sm">
              {isLoading ? <LoadingSpinner /> : 'Lưu bài thi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExamFormModal;