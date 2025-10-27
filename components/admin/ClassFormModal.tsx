import React, { useState, useEffect } from 'react';
import type { Class } from '../../types';
import { addClass, updateClass } from '../../services/examService';
import { LoadingSpinner } from '../icons/LoadingSpinner';

interface ClassFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  initialClass: Class | null;
}

const ClassFormModal: React.FC<ClassFormModalProps> = ({ isOpen, onClose, onSave, initialClass }) => {
  const [className, setClassName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialClass) {
      setClassName(initialClass.name);
    } else {
      setClassName('');
    }
    setError('');
  }, [initialClass, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      setError('Tên lớp không được để trống.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      if (initialClass) {
        await updateClass({ ...initialClass, name: className });
      } else {
        await addClass(className);
      }
      onSave();
    } catch (err) {
      console.error("Failed to save class", err);
      setError('Đã xảy ra lỗi khi lưu. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {initialClass ? 'Sửa lớp học' : 'Thêm lớp học mới'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg">{error}</div>}

          <div>
            <label htmlFor="className" className="block text-sm font-medium text-gray-700">Tên lớp</label>
            <input
              id="className"
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="ví dụ: Lớp 12A1 - Khóa 2024"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="bg-white hover:bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg border border-gray-300 transition-colors">Hủy</button>
            <button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center disabled:bg-indigo-400 transition-colors">
              {isLoading ? <LoadingSpinner /> : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassFormModal;