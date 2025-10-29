import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { CloudUploadIcon } from '../icons/CloudUploadIcon';
import { LoadingSpinner } from '../icons/LoadingSpinner';

interface StudentData {
  email: string;
  fullName: string;
  classId: string;
}

interface ProcessResult {
  email: string;
  success: boolean;
  message: string;
}

const StudentImporter: React.FC = () => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ProcessResult[]>([]);
  const [error, setError] = useState('');

  /**
   * Chuẩn hóa tên cột và giá trị từ một hàng dữ liệu để phù hợp với StudentData.
   * Xử lý các biến thể tên cột (ví dụ: 'mail', 'hovaten', 'lop')
   * và làm sạch giá trị (trim).
   * @param row Hàng dữ liệu gốc từ file.
   * @returns Đối tượng StudentData đã được chuẩn hóa một phần.
   */
  const normalizeStudentRow = (row: Record<string, unknown>): Partial<StudentData> => {
    // Chuẩn hóa tên cột: trim, lowercase, loại bỏ ký tự không phải chữ/số
    const normalizedEntries = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value === undefined || value === null) {
        return acc;
      }

      const normalizedKey = key
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

        acc[normalizedKey] = String(value);
      return acc;
    }, {});

    // Ánh xạ các tên cột đã chuẩn hóa về tên thuộc tính StudentData
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
    };

    const normalizedStudent: Partial<StudentData> = {};

    Object.entries(keyMap).forEach(([normalizedKey, targetKey]) => {
      if (normalizedEntries[normalizedKey]) {
        normalizedStudent[targetKey] = normalizedEntries[normalizedKey];
      }
    });

    return normalizedStudent;
  };

  /**
   * Xử lý dữ liệu thô từ file (CSV/Excel) và chuyển đổi thành mảng StudentData hợp lệ.
   * @param data Mảng các đối tượng dữ liệu thô.
   */
  const processData = (data: any[]) => {
    // Lọc bỏ các hàng rỗng hoặc không phải đối tượng và chuẩn hóa các hàng còn lại
    const normalizedRows = data
      .filter((row) => row && typeof row === 'object')
      .map((row) => normalizeStudentRow(row as Record<string, unknown>));

    // Lọc chỉ lấy những hàng đã được chuẩn hóa và có đủ 3 trường bắt buộc
    const validData: StudentData[] = normalizedRows.filter(
      (row): row is StudentData => Boolean(row.email && row.fullName && row.classId)
    ) as StudentData[];

    setStudents(validData);

    // Xử lý thông báo lỗi dựa trên kết quả xử lý
    if (validData.length === 0 && data.length > 0) {
      setError(
        "File không chứa dữ liệu hợp lệ. Hãy chắc chắn file có các cột 'email', 'fullName', và 'classId' hoặc các tên tương đương."
      );
      return; // Dừng lại, không cần kiểm tra lỗi khác nếu không có dữ liệu hợp lệ nào
    }

    if (validData.length < normalizedRows.length) {
      setError('Một số dòng bị bỏ qua do thiếu thông tin email, họ tên hoặc mã lớp.');
      return; // Dừng lại, không cần kiểm tra lỗi khác nếu đã có lỗi bỏ qua dòng
    }

    setError(''); // Xóa lỗi nếu mọi thứ đều hợp lệ
  };

  /**
   * Xử lý sự kiện khi người dùng chọn file.
   * @param event Đối tượng sự kiện thay đổi input file.
   */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setStudents([]);
      setResults([]);
      setError('');

      const reader = new FileReader();
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        reader.onload = (e) => {
            Papa.parse(e.target?.result as string, {
                header: true,
                
                complete: (result) => processData(result.data),
                error: (err) => setError(`Lỗi khi đọc file CSV: ${err.message}`)
            });
        };
        reader.readAsText(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0]; // Lấy sheet đầu tiên
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, {blankrows: true,defval: " ",  });
                processData(json);
            } catch (err: any) {
                setError(`Lỗi khi đọc file Excel: ${err.message}`);
            }
        };
        reader.readAsBinaryString(file);
      } else {
        setError("Định dạng file không được hỗ trợ. Vui lòng chọn file CSV hoặc Excel (.xlsx, .xls).");
      }
    }
  };

  /**
   * Xử lý sự kiện khi người dùng nhấn nút "Bắt đầu Nhập".
   * Gửi dữ liệu học sinh đến Cloud Function để tạo tài khoản.
   */
  const handleImport = async () => {
    if (students.length === 0) {
      setError('Không có dữ liệu học sinh hợp lệ để nhập.');
      return;
    }
    setIsLoading(true);
    setResults([]);
    setError('');

    try {
      // Gọi Cloud Function để tạo hàng loạt người dùng
      const bulkCreateUsers = httpsCallable(functions, 'bulkCreateUsers');
      const response = await bulkCreateUsers({ students });
      const data = response.data as { results: ProcessResult[] };
      setResults(data.results || []);
    } catch (err: any) {
      console.error("Lỗi khi gọi Cloud Function:", err);
      // Cải thiện thông báo lỗi cho người dùng
      setError(`Lỗi nghiêm trọng khi thực thi: ${err.message || 'Không thể kết nối đến máy chủ.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-4 max-w-4xl mx-auto">
      <h3 className="text-2xl font-bold mb-4 text-gray-800">Nhập Học sinh từ File</h3>
      <p className="mb-6 text-sm text-gray-600 leading-relaxed">
      Chọn một file <strong>CSV</strong> hoặc <strong>Excel</strong> có chứa thông tin học sinh. File phải có các cột: <strong>email</strong>, <strong>fullName</strong>, và <strong>classId</strong>. Các biến thể tên cột như 'mail', 'name', 'hovaten', 'class', 'malop' cũng được hỗ trợ. Nếu không cung cấp cột <strong>password</strong>, hệ thống sẽ đặt mật khẩu mặc định là <strong>123456</strong>.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <label className="flex flex-col items-center justify-center w-full min-h-[120px] px-4 py-6 bg-white text-blue-600 rounded-lg shadow-lg tracking-wide uppercase border-2 border-dashed border-blue-400 cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-all duration-200">
          <CloudUploadIcon className="w-10 h-10 mb-2" />
          <span className="mt-2 text-base leading-normal text-center font-medium">
            {fileName || 'Chọn một file CSV hoặc Excel'}
          </span>
          <input type='file' accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileChange} />
        </label>
        <button
          onClick={handleImport}
          disabled={students.length === 0 || isLoading}
          className="flex items-center justify-center w-full min-h-[120px] px-6 py-3 text-white bg-green-600 rounded-lg shadow-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 text-lg font-semibold"
        >
          {isLoading ? <LoadingSpinner className="w-6 h-6 mr-2 text-white" /> : null}
          {isLoading ? 'Đang nhập...' : 'Bắt đầu Nhập'}
        </button>
      </div>

      {/* Hiển thị lỗi chung */}
      {error && (
        <p className="text-red-600 bg-red-100 border border-red-300 p-3 rounded-md mt-4 text-sm font-medium">
          {error}
        </p>
      )}
      
      {/* Xem trước dữ liệu */}
      {students.length > 0 && !isLoading && (
         <div className="mt-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h4 className="font-bold text-lg mb-3 text-gray-700">Xem trước dữ liệu ({students.length} học sinh):</h4>
            <div className="max-h-60 overflow-y-auto mt-2 border border-gray-300 rounded-md shadow-inner">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0"> {/* sticky header */}
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Họ và Tên</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Mã Lớp</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {/* Chỉ hiển thị tối đa 10 dòng để xem trước */}
                        {students.slice(0, 10).map((student, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{student.email}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{student.fullName}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">{student.classId}</td>
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

      {/* Kết quả nhập liệu */}
      {results.length > 0 && (
        <div className="mt-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <h4 className="font-bold text-lg mb-3 text-gray-700">Kết quả nhập liệu:</h4>
          <div className="max-h-60 overflow-y-auto mt-2 border border-gray-300 rounded-md shadow-inner">
            <ul className="divide-y divide-gray-200">
                {results.map((result, index) => (
                    <li key={index} className={`p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center ${result.success ? 'bg-green-50' : 'bg-red-50'} hover:bg-opacity-75 transition-colors duration-150`}>
                        <span className="text-sm font-medium text-gray-900">{result.email}</span>
                        <div className="flex items-center space-x-2 mt-1 sm:mt-0">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${result.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                                {result.success ? 'Thành công' : 'Thất bại'}
                            </span>
                            {!result.success && (
                                <p className="text-xs text-red-700 max-w-xs text-right break-words">
                                    {result.message}
                                </p>
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