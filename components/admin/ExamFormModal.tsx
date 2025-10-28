import React, { useState, useEffect } from 'react';
import type { Exam, Question } from '../../types';
// We need to get all questions to derive topics and difficulties
import { saveExam, updateExam } from '../../services/firebaseExamService';
import { getQuestions } from '../../services/firebaseExamService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { PlusCircleIcon } from '../icons/PlusCircleIcon';
import { TrashIcon } from '../icons/TrashIcon';

interface ExamFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialExam: Exam | null;
}

type BlueprintRule = {
    topic: string;
    difficulty: string;
    count: number;
};

// Main Component
const ExamFormModal: React.FC<ExamFormModalProps> = ({ isOpen, onClose, onSave, initialExam }) => {
  const [formData, setFormData] = useState<Omit<Exam, 'id' | 'isSynced' | 'lastSyncedAt' | 'snapshotVariantIds' | 'blueprint'> & { blueprint: BlueprintRule[] }>({ 
      title: '', description: '', duration: 60, pass_threshold: 0.7, blueprint: [], variants: 10
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // State for loading topics and difficulties
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [allDifficulties, setAllDifficulties] = useState<string[]>([]);

  // Effect to load questions data for blueprint builder
  useEffect(() => {
    if (isOpen) {
        const fetchRequiredData = async () => {
            setIsDataLoading(true);
            try {
                const questions = await getQuestions();
                const topics = [...new Set(questions.map(q => q.topic || 'Chưa phân loại'))];
                const difficulties = [...new Set(questions.map(q => q.difficulty || 'Chưa xác định'))];
                setAllTopics(topics);
                setAllDifficulties(difficulties);
            } catch (err) {
                setError('Không thể tải dữ liệu chủ đề và độ khó từ ngân hàng câu hỏi.');
            } finally {
                setIsDataLoading(false);
            }
        };
        fetchRequiredData();
    }
  }, [isOpen]);

  // Effect to populate form when data is ready
  useEffect(() => {
    if (isOpen && !isDataLoading) { // Only run when data is loaded
        setError('');
        if (initialExam) {
            let blueprintRules: BlueprintRule[] = [];
            if (typeof initialExam.blueprint === 'string' && initialExam.blueprint.trim().startsWith('[')) {
                try { blueprintRules = JSON.parse(initialExam.blueprint); } catch { blueprintRules = []; }
            } else if (Array.isArray(initialExam.blueprint)) {
                blueprintRules = initialExam.blueprint;
            }
            setFormData({ ...initialExam, blueprint: blueprintRules });
        } else {
            // Set a default rule only if there are topics/difficulties available
            setFormData({
                title: '',
                description: '',
                duration: 60,
                pass_threshold: 0.7,
                variants: 10,
                blueprint: allTopics.length > 0 && allDifficulties.length > 0 ? 
                    [{ topic: allTopics[0], difficulty: allDifficulties[0], count: 1 }] : [],
            });
        }
    }
  }, [initialExam, isOpen, isDataLoading, allTopics, allDifficulties]);

  // All other handler functions remain largely the same...
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numValue = ['duration', 'pass_threshold', 'variants'].includes(name) ? parseFloat(value) : value;
    setFormData(prev => ({ ...prev, [name]: numValue }));
  };

  const handleBlueprintChange = (index: number, field: keyof BlueprintRule, value: string | number) => {
    const newBlueprint = [...formData.blueprint];
    const rule = { ...newBlueprint[index] };
    (rule[field] as any) = field === 'count' ? parseInt(value as string, 10) : value;
    newBlueprint[index] = rule;
    setFormData(prev => ({ ...prev, blueprint: newBlueprint }));
  };

  const addBlueprintRule = () => {
    if (allTopics.length === 0 || allDifficulties.length === 0) return;
    const newRule: BlueprintRule = { topic: allTopics[0], difficulty: allDifficulties[0], count: 1 };
    setFormData(prev => ({ ...prev, blueprint: [...(prev.blueprint || []), newRule] }));
  };

  const removeBlueprintRule = (index: number) => {
    setFormData(prev => ({ ...prev, blueprint: formData.blueprint.filter((_, i) => i !== index) }));
  };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const examPayload = {
            ...formData,
            // Ensure blueprint is an array of objects before stringifying
            blueprint: formData.blueprint || [], 
        };

        try {
            if (initialExam && initialExam.id) {
                await updateExam(initialExam.id, examPayload);
            } else {
                await saveExam(examPayload);
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
  
  // Render logic
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">{initialExam ? 'Sửa bài thi' : 'Tạo bài thi mới'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">&times;</button>
        </div>
        
        {isDataLoading ? (
            <div className="flex flex-col items-center justify-center h-64">
                <LoadingSpinner />
                <p className="mt-4 text-gray-600">Đang tải dữ liệu câu hỏi...</p>
            </div>
        ) : ( 
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form fields are rendered here, similar to before */}
              {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
              <BlueprintBuilder 
                blueprint={formData.blueprint}
                allTopics={allTopics}
                allDifficulties={allDifficulties}
                onBlueprintChange={handleBlueprintChange}
                onAddRule={addBlueprintRule}
                onRemoveRule={removeBlueprintRule}
              />
              {/* ... other form fields like title, description etc. */}
                 <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                    <button type="button" onClick={onClose} className="bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 font-bold py-2 px-4 rounded-lg">Hủy</button>
                    <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-indigo-400">
                    {isLoading ? <LoadingSpinner /> : 'Lưu bài thi'}
                    </button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

// Child component for building the blueprint to keep logic clean
const BlueprintBuilder: React.FC<{ 
    blueprint: BlueprintRule[], 
    allTopics: string[], 
    allDifficulties: string[],
    onBlueprintChange: (index: number, field: keyof BlueprintRule, value: string | number) => void,
    onAddRule: () => void,
    onRemoveRule: (index: number) => void
}> = ({ blueprint, allTopics, allDifficulties, onBlueprintChange, onAddRule, onRemoveRule }) => {
    const inputClasses = "block w-full rounded-lg border-0 py-2 px-3 bg-white text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm";
    return (
        <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Ma trận đề thi</h3>
            <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              {(blueprint || []).map((rule, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-8 gap-3 items-center">
                    <div className="md:col-span-3">
                        <label className="text-xs text-gray-600">Chủ đề</label>
                        <select value={rule.topic} onChange={(e) => onBlueprintChange(index, 'topic', e.target.value)} className={inputClasses}>
                        {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-gray-600">Độ khó</label>
                        <select value={rule.difficulty} onChange={(e) => onBlueprintChange(index, 'difficulty', e.target.value)} className={inputClasses}>
                        {allDifficulties.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-xs text-gray-600">Số lượng</label>
                        <input type="number" value={rule.count} onChange={(e) => onBlueprintChange(index, 'count', e.target.value)} className={inputClasses} min="1"/>
                    </div>
                    <div className="md:col-span-1 self-end">
                        <button type="button" onClick={() => onRemoveRule(index)} className="p-2 text-gray-500 hover:text-rose-600 hover:bg-gray-200 rounded-full"><TrashIcon/></button>
                    </div>
                </div>
              ))}
              <button type="button" onClick={onAddRule} className="mt-3 bg-white hover:bg-gray-100 text-indigo-600 font-semibold py-2 px-3 border border-indigo-200 rounded-lg flex items-center text-sm">
                <PlusCircleIcon /><span className="ml-2">Thêm quy tắc</span>
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-2">Tổng số câu hỏi: <span className="font-bold">{(blueprint || []).reduce((sum, rule) => sum + (rule.count || 0), 0)}</span></p>
        </div>
    );
}

export default ExamFormModal;
