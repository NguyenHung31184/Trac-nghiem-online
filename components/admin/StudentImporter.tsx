import React, { useMemo, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { callCallableWithFallbacks } from '../../services/firebaseFunctionsClient';
import { CloudUploadIcon } from '../icons/CloudUploadIcon';
import { LoadingSpinner } from '../icons/LoadingSpinner';

// ===== Types =====
export interface Class {
  id: string;
  name: string;
  code?: string;
}

export interface StudentImporterProps {
  classes: Class[];
}

interface StudentData {
  email: string;
  fullName: string;
  classId: string;
  password?: string; // nếu không có sẽ để mặc định ở backend
}

interface ProcessResult {
  email: string;
  success: boolean;
  message: string;
  password?: string; // tuỳ Cloud Function có trả hay không
}

// ===== Component =====
const StudentImporter: React.FC<StudentImporterProps> = ({ classes }) => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState('');

  // ----- Helpers -----
  const emailRegex = useMemo(() => {
    // đơn giản, đủ dùng cho kiểm tra sơ bộ
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  }, []);

  const classLookup = useMemo(() => {
    const map = new Map<string, Class>();
    classes.forEach((cls) => {
      const idKey = cls.id.trim().toLowerCase();
      if (idKey) map.set(idKey, cls);

      if (cls.code) {
        map.set(cls.code.trim().toLowerCase(), cls);
      }

      const nameKey = cls.name.trim().toLowerCase();
      if (nameKey) map.set(nameKey, cls);
    });
    return map;
  }, [classes]);

  const classById = useMemo(() => {
    const map = new Map<string, Class>();
    classes.forEach((cls) => map.set(cls.id, cls));
    return map;
  }, [classes]);

  const formatClassLabel = (id: string) => {
    const cls = classById.get(id);
    if (!cls) return id;
    const code = cls.code ? `${cls.code} – ` : '';
    return `${code}${cls.name}`;
  };

  const resolveClass = (raw: string | undefined): Class | null => {
    if (!raw) return null;
    const normalized = raw.trim().toLowerCase();
    if (!normalized) return null;
    return classLookup.get(normalized) ?? null;
  };

  /** Chuẩn hoá 1 hàng dữ liệu từ CSV/Excel về gần StudentData */
  const normalizeStudentRow = (row: Record<string, unknown>): Partial<StudentData> => {
    // chuẩn hoá tên cột
    const normalizedEntries = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === undefined || value === null) return acc;
      const normalizedKey = key.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      acc[normalizedKey] = String(value);
      return acc;
    }, {});

    // ánh xạ key phổ biến về field chuẩn
    const keyMap: Record<string, keyof StudentData> = {
      email: 'email',
      mail: 'email',
      fullname: 'fullName',
      name: 'fullName',
      hovaten: 'fullName',
      classid: 'classId',
      class: 'classId',
      malop: 'classId',
      lop: 'classId',
      password: 'password',
      matkhau: 'password',
    };

    const normalizedStudent: Partial<StudentData> = {};
    Object.entries(keyMap).forEach(([normalizedKey, targetKey]) => {
      const rawValue = normalizedEntries[normalizedKey];
      if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
        normalizedStudent[targetKey] = rawValue.trim();
      }
    });

    return normalizedStudent;
  };

  /** Xử lý mảng dữ liệu thô thành mảng StudentData hợp lệ */
  const processData = (data: any[]) => {
    const normalizedRows = data
      .filter((row) => row && typeof row === 'object')
      .map((row) => normalizeStudentRow(row as Record<string, unknown>));

    // đủ 3 trường bắt buộc
    const completedRows = normalizedRows.filter(
      (row): row is { email: string; fullName: string; classId: string; password?: string } =>
        Boolean(row.email && row.fullName && row.classId)
    );

    const missingClassLabels = new Set<string>();
    const validList: StudentData[] = [];

    completedRows.forEach((row) => {
      const resolved = resolveClass(row.classId);
      if (!resolved) {
        missingClassLabels.add(row.classId.trim());
        return;
      }

      const email = row.email.trim().toLowerCase();
      if (!emailRegex.test(email)) {
        // bỏ qua email sai định dạng
        return;
      }

      validList.push({
        email,
        fullName: row.fullName.trim(),
        classId: resolved.id,
        ...(row.password ? { password: String(row.password) } : {}),
      });
    });

    // khử trùng lặp theo email (giữ bản ghi xuất hiện sau cùng)
    const dedupMap = new Map<string, StudentData>();
    validList.forEach((s) => dedupMap.set(s.email, s));
    const finalStudents = Array.from(dedupMap.values());

    setStudents(finalStudents);
    setResults([]);

    // Thông điệp cảnh báo/lỗi thân thiện
    if (completedRows.length === 0 && normalizedRows.length > 0) {
      setError("File không chứa dữ liệu hợp lệ. Hãy chắc chắn file có các cột 'email', 'fullName', và 'classId' hoặc các tên tương đương.");
      setWarnings('');
      return;
    }

    const skippedBase = normalizedRows.length - completedRows.length;
    const skippedForClass = missingClassLabels.size;
    const skippedForFormat = validList.length - finalStudents.length; // email trùng/bị loại

    const warningsList: string[] = [];
    if (skippedBase > 0) warningsList.push('Một số dòng thiếu email/họ tên/mã lớp đã bị bỏ qua.');
    if (skippedForClass > 0) warningsList.push(`Không tìm thấy các lớp: ${Array.from(missingClassLabels).join(', ')}.`);
    if (skippedForFormat > 0) warningsList.push('Một số dòng bị loại/bị gộp do email sai định dạng hoặc trùng lặp.');

    setError('');
    setWarnings(warningsList.join(' '));
  };

  /** Khi chọn file */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStudents([]);
    setResults([]);
    setError('');
    setWarnings('');

    const reader = new FileReader();
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      reader.onload = (e) => {
        Papa.parse(e.target?.result as string, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (result) => processData(result.data),
          error: (err) => setError(`Lỗi khi đọc file CSV: ${err.message}`),
        });
      };
      reader.readAsText(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, {
            blankrows: false,
            defval: '', // tránh chuỗi ' '
          });
          processData(json);
        } catch (err: any) {
          setError(`Lỗi khi đọc file Excel: ${err.message}`);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setError('Định dạng file không được hỗ trợ. Vui lòng chọn file CSV hoặc Excel (.xlsx, .xls).');
    }
  };

  /** Gửi dữ liệu sang Cloud Function để tạo tài khoản */
  const handleImport = async () => {
    if (students.length === 0) {
      setError('Không có dữ liệu học sinh hợp lệ để nhập.');
      return;
    }

    setIsLoading(true);
    setResults([]);
    setError('');

    try {
      const data = await callCallableWithFallbacks<{ students: StudentData[] }, { results: ProcessResult[] }>(
        'bulkCreateUsers',
        { students }
      );
      setResults(data.results || []);
    } catch (err: any) {
      console.error('Lỗi khi gọi Cloud Function:', err);
      setError(`Lỗi nghiêm trọng khi thực thi: ${err?.message || 'Không thể kết nối đến máy chủ.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-4 max-w-4xl mx-auto">
      <h3 className="text-2xl font-bold mb-4 text-gray-800">Nhập Học sinh từ File</h3>
      <p className="mb-6 text-sm text-gray-600 leading-relaxed">
        Chọn một file <strong>CSV</strong> hoặc <strong>Excel</strong> có chứa thông tin học sinh. File phải có các cột: <strong>email</strong>, <strong>fullName</strong>, và <strong>classId</strong> (hoặc các biến thể như 'mail', 'name', 'hovaten', 'class', 'malop'). Nếu không cung cấp cột <strong>password</strong>, hệ thống sẽ đặt mật khẩu mặc định là <strong>123456</strong>.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <label className="inline-flex w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">
          <CloudUploadIcon className="h-5 w-5" />
          <span className="truncate">{fileName || 'Chọn file CSV hoặc Excel'}</span>
          <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileChange} />
        </label>
        <button
          onClick={handleImport}
          disabled={students.length === 0 || isLoading}
          className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isLoading ? <LoadingSpinner className="mr-2 h-4 w-4 text-white" /> : null}
          {isLoading ? 'Đang nhập...' : 'Bắt đầu nhập'}
        </button>
      </div>

      {error && (
        <p className="text-red-600 bg-red-100 border border-red-300 p-3 rounded-md mt-4 text-sm font-medium">{error}</p>
      )}

      {warnings && !error && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{warnings}</p>
      )}

      {students.length > 0 && !isLoading && (
        <div className="mt-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="font-bold text-lg mb-3 text-gray-700">Xem trước dữ liệu ({students.length} học sinh):</h4>
          <div className="max-h-60 overflow-y-auto mt-2 border border-gray-300 rounded-md shadow-inner">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Họ và Tên</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lớp</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {students.slice(0, 10).map((s, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{s.email}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{s.fullName}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{formatClassLabel(s.classId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length > 10 && (
              <p className="text-center text-sm text-gray-500 p-2 bg-gray-50 border-t border-gray-200">
                ... và {students.length - 10} học sinh khác không hiển thị trong bản xem trước.
              </p>
            )}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="font-bold text-lg mb-3 text-gray-700">Kết quả nhập liệu:</h4>
          <div className="max-h-60 overflow-y-auto mt-2 border border-gray-300 rounded-md shadow-inner">
            <ul className="divide-y divide-gray-200">
              {results.map((r, idx) => (
                <li
                  key={idx}
                  className={`p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center ${r.success ? 'bg-green-50' : 'bg-red-50'} hover:bg-opacity-75 transition-colors duration-150`}
                >
                  <span className="text-sm font-medium text-gray-900">{r.email}</span>
                  <div className="flex items-center space-x-2 mt-1 sm:mt-0">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${r.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {r.success ? 'Thành công' : 'Thất bại'}
                    </span>
                    {!r.success && (
                      <p className="text-xs text-red-700 max-w-xs text-right break-words">{r.message}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentImporter;
