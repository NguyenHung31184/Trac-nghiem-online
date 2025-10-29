import React, { useState, useEffect } from 'react';
import type { Exam, Class, ExamWindow } from '../../types';
import { addWindow } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';
import { RefreshIcon } from '../icons/RefreshIcon';

interface SchedulingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  exams: Exam[];
  classes: Class[];
}

const SchedulingFormModal: React.FC<SchedulingFormModalProps> = ({ isOpen, onClose, onSave, exams, classes }) => {
  const [formData, setFormData] = useState({
    examId: exams[0]?.id || '',
    classId: classes[0]?.id || '',
    start_at: '',
    end_at: '',
    accessCode: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Reset form when opening
      setFormData({
        examId: exams[0]?.id || '',
        classId: classes[0]?.id || '',
        start_at: '',
        end_at: '',
        accessCode: generateAccessCode(),
      });
      setError('');
    }
  }, [isOpen, exams, classes]);

  const generateAccessCode = (length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.examId || !formData.classId || !formData.start_at || !formData.end_at) {
        setError('Vui lòng điền đầy đủ tất cả các trường.');
        return;
    }
    const startTime = new Date(formData.start_at).getTime();
    const endTime = new Date(formData.end_at).getTime();

    if (startTime >= endTime) {
        setError('Thời gian kết thúc phải sau thời gian bắt đầu.');
        return;
    }

    setIsLoading(true);
    setError('');

    try {
      const windowPayload: Omit<ExamWindow, 'id'> = {
        examId: formData.examId,
        classId: formData.classId,
        start_at: startTime,
        end_at: endTime,
        accessCode: formData.accessCode,
      };
      await addWindow(windowPayload);
      onSave();
    } catch (err: any) {
      console.error("Failed to save window", err);
      setError(`Lưu ca thi thất bại: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;
  
  const inputClasses = "block w-full rounded-lg border-0 py-2 px-3 bg-white text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6";
  const labelClasses = "block text-sm font-medium leading-6 text-gray-900";


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 transition-opacity">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-2xl w-full">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Lên lịch ca thi mới</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
            
            <div>
                <label htmlFor="examId" className={labelClasses}>Bài thi</label>
                <div className="mt-1">
                    <select id="examId" name="examId" value={formData.examId} onChange={handleInputChange} className={inputClasses} required>
                        {exams.map(exam => <option key={exam.id} value={exam.id}>{exam.title}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label htmlFor="classId" className={labelClasses}>Lớp học</label>
                <div className="mt-1">
                    <select id="classId" name="classId" value={formData.classId} onChange={handleInputChange} className={inputClasses} required>
                    {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                            {cls.code ? ` (${cls.code})` : ''}
                          </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="start_at" className={labelClasses}>Thời gian bắt đầu</label>
                    <div className="mt-1">
                        <input id="start_at" name="start_at" type="datetime-local" value={formData.start_at} onChange={handleInputChange} className={inputClasses} required />
                    </div>
                </div>
                <div>
                    <label htmlFor="end_at" className={labelClasses}>Thời gian kết thúc</label>
                    <div className="mt-1">
                        <input id="end_at" name="end_at" type="datetime-local" value={formData.end_at} onChange={handleInputChange} className={inputClasses} required />
                    </div>
                </div>
            </div>

            <div>
                 <label htmlFor="accessCode" className={labelClasses}>Mã truy cập</label>
                <div className="mt-1 flex items-center gap-2">
                    <input id="accessCode" name="accessCode" type="text" value={formData.accessCode} onChange={handleInputChange} className={inputClasses} required />
                    <button type="button" onClick={() => setFormData(prev => ({...prev, accessCode: generateAccessCode()}))} className="p-2 bg-white hover:bg-gray-100 rounded-lg border border-gray-300" title="Tạo mã mới">
                        <RefreshIcon className="h-5 w-5 text-gray-600"/>
                    </button>
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                <button type="button" onClick={onClose} className="bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 font-bold py-2 px-4 rounded-lg transition-colors text-sm">Hủy</button>
                <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-indigo-400 transition-colors shadow-sm text-sm">
                {isLoading ? <LoadingSpinner /> : 'Lưu ca thi'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default SchedulingFormModal;
