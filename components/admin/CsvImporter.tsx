
import React, { useState } from 'react';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';

interface CsvImporterProps {
  onImportComplete: () => void;
  onImportError: (error: string) => void;
}

const CsvImporter: React.FC<CsvImporterProps> = ({ onImportComplete, onImportError }) => {
  const [csvData, setCsvData] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleImport = async () => {
    if (!csvData.trim()) {
      onImportError('Dữ liệu CSV không được để trống.');
      return;
    }

    setIsLoading(true);
    try {
      const db = getFirestore();
      const batch = writeBatch(db);
      
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      // Find header indices
      const idIndex = headers.indexOf('ID Câu hỏi');
      const questionIndex = headers.indexOf('Câu hỏi');
      const optionAIndex = headers.indexOf('Đáp án A');
      const optionBIndex = headers.indexOf('Đáp án B');
      const optionCIndex = headers.indexOf('Đáp án C');
      const optionDIndex = headers.indexOf('Đáp án D');
      const correctIndex = headers.indexOf('Đáp án đúng (chép lại nội dung)');
      const pointsIndex = headers.indexOf('Points');
      const topicIndex = headers.indexOf('Chủ đề/Lớp Nghề');
      const difficultyIndex = headers.indexOf('Bậc/Độ khó');
      const imageIndex = headers.indexOf('Link ảnh minh họa (nếu có)');

      if (idIndex === -1 || questionIndex === -1 || correctIndex === -1) {
          throw new Error('Các cột tiêu đề bắt buộc (ID Câu hỏi, Câu hỏi, Đáp án đúng) không được tìm thấy.');
      }

      // Start from the second line
      for (let i = 1; i < lines.length; i++) {
        const data = lines[i].split(',');

        const questionId = data[idIndex]?.trim();
        if (!questionId) continue; // Skip empty rows

        const options = [
            data[optionAIndex]?.trim(),
            data[optionBIndex]?.trim(),
            data[optionCIndex]?.trim(),
            data[optionDIndex]?.trim()
        ].filter(Boolean); // Filter out any empty options

        const questionData = {
          id: questionId,
          questionText: data[questionIndex]?.trim() || '',
          options: options,
          correctAnswer: data[correctIndex]?.trim() || '',
          points: parseInt(data[pointsIndex]?.trim(), 10) || 1,
          topic: data[topicIndex]?.trim() || '',
          difficulty: data[difficultyIndex]?.trim() || 'Trung bình',
          imageUrl: data[imageIndex]?.trim() || '',
        };

        const questionRef = doc(db, 'questionBank', questionId);
        batch.set(questionRef, questionData);
      }

      await batch.commit();
      onImportComplete();
    } catch (error: any) {
      console.error("Lỗi khi nhập CSV:", error);
      onImportError(`Đã xảy ra lỗi: ${error.message}`);
    } finally {
      setIsLoading(false);
      setCsvData('');
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-inner mt-6">
      <h3 className="text-lg font-semibold mb-2 text-gray-700">Nhập Ngân hàng câu hỏi từ CSV</h3>
      <p className="text-sm text-gray-600 mb-4">
        1. Mở file Google Sheet của bạn. <br/>
        2. Chọn <strong>Tệp &gt; Tải xuống &gt; Giá trị được phân tách bằng dấu phẩy (.csv)</strong>.<br/>
        3. Mở file .csv vừa tải, sao chép toàn bộ nội dung và dán vào ô dưới đây.
      </p>
      <textarea
        className="w-full h-48 p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
        placeholder="Dán nội dung CSV vào đây..."
        value={csvData}
        onChange={(e) => setCsvData(e.target.value)}
        disabled={isLoading}
      />
      <button
        onClick={handleImport}
        disabled={isLoading}
        className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isLoading ? 'Đang xử lý...' : 'Bắt đầu Nhập'}
      </button>
    </div>
  );
};

export default CsvImporter;
