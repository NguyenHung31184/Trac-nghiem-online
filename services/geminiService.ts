
import { GoogleGenAI, Type } from "@google/genai";
import { marked } from 'marked';
import type { AuditLog } from '../types';

// IMPORTANT: This key is retrieved from environment variables.
// Do not hardcode API keys in a real application.
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const generateStudyNotes = async (topics: string[]): Promise<string> => {
  if (!API_KEY) {
      return Promise.resolve("<h3>Khóa API Gemini chưa được định cấu hình</h3><p>Các tính năng AI đã bị tắt. Vui lòng định cấu hình khóa API của bạn để bật chúng.</p>");
  }

  const uniqueTopics = [...new Set(topics)];
  const prompt = `
    Tôi vừa hoàn thành một bài kiểm tra và cần trợ giúp ôn tập các chủ đề tôi đã làm sai. 
    Các chủ đề đó là: ${uniqueTopics.join(', ')}.

    Vui lòng tạo một hướng dẫn ôn tập ngắn gọn, dễ hiểu cho các chủ đề này. 
    Sử dụng định dạng markdown. Đối với mỗi chủ đề, hãy cung cấp:
    1. Giải thích ngắn gọn về khái niệm cốt lõi.
    2. Một ví dụ mã đơn giản hoặc một sự thật quan trọng.
    3. Một hoặc hai điểm quan trọng cần nhớ.

    Cấu trúc câu trả lời của bạn với các tiêu đề rõ ràng cho mỗi chủ đề.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: prompt,
    });
    
    const markdownText = response.text;
    const htmlContent = await marked.parse(markdownText, { async: true, gfm: true });
    return htmlContent;

  } catch (error) {
    console.error("Gemini API call failed:", error);
    return "<p><strong>Lỗi:</strong> Không thể tạo ghi chú ôn tập vào lúc này. Dịch vụ AI có thể không khả dụng hoặc khóa API không hợp lệ.</p>";
  }
};

export const generateQuestion = async (topic: string, difficulty: 'easy'|'medium'|'hard'): Promise<{stem: string, options: string[], answerIndex: number} | null> => {
    if (!API_KEY) {
        throw new Error("Chưa định cấu hình API_KEY.");
    }
    
    const prompt = `Tạo một câu hỏi trắc nghiệm cho một kỳ thi trực tuyến về chủ đề "${topic}" với độ khó là "${difficulty}". 
    Câu hỏi nên có 4 lựa chọn. Đáp án phải là một trong các lựa chọn đó.
    Cung cấp câu trả lời của bạn dưới dạng một đối tượng JSON có cấu trúc sau: 
    { "stem": "Nội dung câu hỏi ở đây...", "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"], "answerIndex": 0 }
    Phần thân câu hỏi có thể chứa các thẻ HTML đơn giản như <code> và <p>. Đảm bảo JSON hợp lệ.`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        stem: { type: Type.STRING },
                        options: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        answerIndex: { type: Type.INTEGER }
                    },
                },
            }
        });
        
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        
        if (parsed.stem && Array.isArray(parsed.options) && typeof parsed.answerIndex === 'number') {
            return parsed;
        }
        return null;
    } catch(e) {
        console.error("Không thể tạo câu hỏi bằng AI", e);
        return null;
    }
};

export const summarizeAuditLogs = async (logs: AuditLog[]): Promise<string> => {
    if (!API_KEY) {
      return Promise.resolve("<p>Các tính năng AI đã bị tắt.</p>");
    }

    if (logs.length === 0) {
        return Promise.resolve("<p>Không có hoạt động đáng ngờ nào được ghi lại cho lần thử này.</p>");
    }

    const logSummary = logs.map(log => `- Vào lúc ${new Date(log.timestamp).toLocaleTimeString()}, sự kiện '${log.event}' đã xảy ra.`).join('\n');

    const prompt = `
        Với vai trò là giám thị kỳ thi, tôi đang xem lại nhật ký hoạt động của một học viên. Vui lòng tóm tắt các sự kiện sau và đưa ra đánh giá ngắn gọn về việc liệu mô hình hoạt động có đáng ngờ hay không. Một vài sự kiện riêng lẻ là bình thường, nhưng các cụm sự kiện (đặc biệt là 'visibility_hidden' hoặc 'focus_lost') là đáng ngờ.

        Nhật ký sự kiện:
        ${logSummary}

        Cung cấp bản tóm tắt của bạn ở định dạng Markdown. Bắt đầu bằng tiêu đề "Tóm tắt giám sát" và kết thúc bằng một kết luận (ví dụ: "Kết luận: Rủi ro gian lận thấp." hoặc "Kết luận: Nghi ngờ gian lận cao do nhiều lần chuyển tab.").
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        
        const markdownText = response.text;
        const htmlContent = await marked.parse(markdownText, { async: true, gfm: true });
        return htmlContent;

    } catch (error) {
        console.error("Gemini log summarization failed:", error);
        return "<p><strong>Lỗi:</strong> Không thể tạo tóm tắt.</p>";
    }
};
