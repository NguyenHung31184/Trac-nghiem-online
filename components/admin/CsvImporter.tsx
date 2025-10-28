import React, { useState } from 'react';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
// To enable Excel import, you must first install the 'xlsx' library:
// npm install xlsx
import * as XLSX from 'xlsx';

interface CsvImporterProps {
  onImportComplete: (totalImported: number) => void;
  onImportError: (error: string) => void;
  onProgress: (message: string) => void;
}

const BATCH_SIZE = 400;

// The old `parseCsvRow` function is removed as `xlsx` library handles parsing.

const CsvImporter: React.FC<CsvImporterProps> = ({ onImportComplete, onImportError, onProgress }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    } else {
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      onImportError('Vui lòng chọn một tệp Excel (.xlsx) hoặc CSV (.csv) để nhập.');
      return;
    }

    setIsLoading(true);
    onProgress('Bắt đầu quá trình nhập... Vui lòng không đóng tab này.');

    try {
      const db = getFirestore();
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      
      const data: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        throw new Error("Tệp không có dữ liệu hoặc không đúng định dạng. Hãy chắc chắn dòng đầu tiên là dòng tiêu đề.");
      }

      let totalImported = 0;

      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const chunk = data.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        
        onProgress(`Đang xử lý: ${i + chunk.length} / ${data.length} câu hỏi...`);

        for (const row of chunk) {
            const id = row['ID Câu hỏi'] || row['ID'];
            const questionText = row['Câu hỏi'] || row['Câu hỏi (Nội dung chính)'];
            const correctText = row['Đáp án đúng (chép lại nội dung)'] || row['Correct Text'];
            const topic = row['Chủ đề/Lớp/Ngành'] || row['Topic'];

            if (!id || !questionText || !correctText) {
              console.warn("Bỏ qua dòng do thiếu các trường bắt buộc (ID, Câu hỏi, Đáp án đúng):", row);
              continue;
            }

            const options = [
                row['Đáp án A'], row['A'],
                row['Đáp án B'], row['B'],
                row['Đáp án C'], row['C'],
                row['Đáp án D'], row['D'],
            ].filter(opt => opt != null && String(opt).trim() !== '').map(String);
            
            // Remove duplicates from options if alternate headers were matched
            const uniqueOptions = [...new Set(options)];

            const questionData = {
                id: String(id).trim(),
                questionText: String(questionText).trim(),
                options: uniqueOptions,
                correctAnswer: String(correctText).trim(),
                points: parseInt(row['Points'] || row['Điểm'], 10) || 1,
                topic: String(topic).trim(),
                difficulty: String(row['Bậc/Độ khó'] || row['Bậc'] || row['Difficulty'] || 'Trung bình').trim(),
                imageUrl: String(row['Link ảnh minh họa (nếu có)'] || row['Image Link'] || '').trim(),
            };

            const questionRef = doc(db, 'questionBank', questionData.id);
            batch.set(questionRef, questionData);
        }

        await batch.commit();
        totalImported += chunk.length;
      }

      onImportComplete(totalImported);

    } catch (error: any) {
      console.error("Lỗi khi nhập tệp:", error);
      onImportError(`Đã xảy ra lỗi: ${error.message}`);
    } finally {
      setIsLoading(false);
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if(fileInput) fileInput.value = '';
      setFile(null);
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-inner mt-6">
      <h3 className="text-lg font-semibold mb-2 text-gray-700">Nhập từ tệp Excel / CSV</h3>
       <p className="text-sm text-gray-600 mb-4">
        1. Chuẩn bị tệp Excel (<strong>.xlsx</strong>) hoặc CSV (<strong>.csv</strong>). Dòng đầu tiên phải là dòng tiêu đề.<br/>
        2. Nhấp vào nút bên dưới để chọn và tải lên tệp của bạn.
      </p>

      <input
        id="csv-file-input"
        type="file"
        accept=".xlsx, .xls, .csv"
        onChange={handleFileChange}
        disabled={isLoading}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"/>

      <button
        onClick={handleImport}
        disabled={isLoading || !file}
        className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Đang xử lý...' : 'Bắt đầu Nhập'}
      </button>
    </div>
  );
};

export default CsvImporter;
