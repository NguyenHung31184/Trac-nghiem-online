
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

  const processData = (data: any[]) => {
      const validData = data.filter(
        row => row.email && row.fullName && row.classId
      ).map(row => ({
        email: String(row.email).trim(),
        fullName: String(row.fullName).trim(),
        classId: String(row.classId).trim(),
      }));
      setStudents(validData);
      if (validData.length === 0 && data.length > 0) {
          setError("File không chứa dữ liệu hợp lệ. Hãy chắc chắn file có các cột 'email', 'fullName', và 'classId'.");
      }
  }

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
                skipEmptyLines: true,
                complete: (result) => processData(result.data),
                error: (err) => setError(`Lỗi khi đọc file CSV: ${err.message}`)
            });
        };
        reader.readAsText(file);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
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

  const handleImport = async () => {
    if (students.length === 0) {
      setError('Không có dữ liệu học sinh hợp lệ để nhập.');
      return;
    }
    setIsLoading(true);
    setResults([]);
    setError('');

    try {
      const bulkCreateUsers = httpsCallable(functions, 'bulkCreateUsers');
      const response = await bulkCreateUsers({ students });
      const data = response.data as { results: ProcessResult[] };
      setResults(data.results || []);
    } catch (err: any) {
      console.error("Lỗi khi gọi Cloud Function:", err);
      setError(`Lỗi nghiêm trọng khi thực thi: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-4">
      <h3 className="text-xl font-bold mb-4">Nhập Học sinh từ File</h3>
      <p className="mb-4 text-sm text-gray-600">
        Chọn file <strong>CSV</strong> hoặc <strong>Excel</strong> có các cột: <strong>email</strong>, <strong>fullName</strong>, và <strong>classId</strong>. Mật khẩu sẽ được tạo tự động và giống với email.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col items-center justify-center w-full h-full px-4 py-6 bg-white text-blue-500 rounded-lg shadow-lg tracking-wide uppercase border border-blue-500 cursor-pointer hover:bg-blue-500 hover:text-white">
          <CloudUploadIcon className="w-8 h-8" />
          <span className="mt-2 text-base leading-normal text-center">{fileName || 'Chọn một file'}</span>
          <input type='file' accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileChange} />
        </label>
        <button
          onClick={handleImport}
          disabled={students.length === 0 || isLoading}
          className="flex items-center justify-center w-full h-full px-6 py-3 text-white bg-green-600 rounded-lg shadow-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? <LoadingSpinner className="w-5 h-5" /> : 'Bắt đầu Nhập'}
        </button>
      </div>
      {error && <p className="text-red-500 mt-4">{error}</p>}
      
      {students.length > 0 && !isLoading && (
         <div className="mt-6">
            <h4 className="font-bold">Dữ liệu xem trước ({students.length} học sinh):</h4>
            <div className="max-h-60 overflow-y-auto mt-2 border rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Họ và Tên</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mã Lớp</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {students.slice(0, 10).map((student, index) => (
                            <tr key={index}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm">{student.email}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm">{student.fullName}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm">{student.classId}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {students.length > 10 && <p className="text-center text-sm text-gray-500 p-2">... và {students.length - 10} học sinh khác.</p>}
            </div>
         </div>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <h4 className="font-bold">Kết quả nhập liệu:</h4>
          <div className="max-h-60 overflow-y-auto mt-2 border rounded-md">
            <ul className="divide-y divide-gray-200">
                {results.map((result, index) => (
                    <li key={index} className={`p-3 flex justify-between items-center ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
                        <span className="text-sm">{result.email}</span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${result.success ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            {result.success ? 'Thành công' : 'Thất bại'}
                        </span>
                        {!result.success && <p className="text-xs text-red-600 w-1/2 text-right">{result.message}</p>}
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
