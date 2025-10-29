+206-0
import React, { useEffect, useMemo, useState } from 'react';
import type { User } from '../../types';
import { upsertStudentAccount } from '../../services/studentAdminService';
import { LoadingSpinner } from '../icons/LoadingSpinner';

interface StudentAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  classes: { id: string; name: string }[];
  initialStudent?: (User & { classIds?: string[] }) | null;
}

const StudentAccountModal: React.FC<StudentAccountModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  classes,
  initialStudent,
}) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [classIdsInput, setClassIdsInput] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditing = Boolean(initialStudent);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialStudent?.email ?? '');
      setFullName(initialStudent?.name ?? '');
      setClassIdsInput((initialStudent?.classIds ?? []).join(', '));
      setPassword('');
      setError('');
    }
  }, [initialStudent, isOpen]);

  const classIdSuggestions = useMemo(() => classes.map((cls) => `${cls.id} – ${cls.name}`), [classes]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim();
    const parsedClassIds = classIdsInput
      .split(',')
      .map((cls) => cls.trim())
      .filter(Boolean);

    if (!normalizedEmail || !normalizedName || parsedClassIds.length === 0) {
      setError('Vui lòng nhập đầy đủ Email, Họ tên và ít nhất một mã lớp.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Email không hợp lệ.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await upsertStudentAccount({
        email: normalizedEmail,
        fullName: normalizedName,
        classIds: parsedClassIds,
        password: password.trim() ? password.trim() : undefined,
      });

      onSuccess(
        response.passwordUpdated
          ? `${response.message} Mật khẩu đã được ${response.operation === 'created' ? 'cấp' : 'cập nhật'}.`
          : response.message
      );
      onClose();
    } catch (err: any) {
      console.error('Failed to upsert student account', err);
      const fallbackMessage = err?.message || 'Không thể lưu tài khoản học viên. Vui lòng thử lại.';

      if (err?.code === 'functions/https-error' && err?.message) {
        setError(err.message);
      } else if (err?.code === 'functions/internal') {
        setError('Không thể kết nối tới Cloud Functions. Hãy chắc chắn đã triển khai hàm upsertStudentAccount và cấu hình VITE_FIREBASE_FUNCTIONS_REGION hoặc VITE_FIREBASE_FUNCTIONS_REGION_FALLBACKS cho đúng vùng của dự án.');
      } else {
        setError(fallbackMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Cập nhật tài khoản học viên' : 'Tạo tài khoản học viên'}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Điền thông tin bên dưới để {isEditing ? 'cập nhật' : 'tạo mới'} tài khoản. Để trống ô mật khẩu nếu muốn dùng mật khẩu mặc định{' '}
              <strong>123456</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-3xl font-semibold text-gray-400 transition hover:text-gray-600"
            aria-label="Đóng"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Email đăng nhập</label>
              <input
                type="email"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isEditing}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Họ và tên</label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Mã lớp (cách nhau bằng dấu phẩy)
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={classIdsInput}
                onChange={(event) => setClassIdsInput(event.target.value)}
                required
                placeholder="VD: lop12a1, lop12a2"
              />
              {classIdSuggestions.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Gợi ý: {classIdSuggestions.join(', ')}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Mật khẩu mới (tùy chọn)</label>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Để trống để dùng mật khẩu mặc định 123456"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-400"
            >
              {isSubmitting ? <LoadingSpinner /> : isEditing ? 'Cập nhật' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentAccountModal;