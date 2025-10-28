import {
  getFirestore,
  collection,
  getDocs,
  doc,
  deleteDoc,
  addDoc,
  updateDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Exam, ExamVariantSnapshot, Question } from '../types'; // Đảm bảo đã import ExamVariantSnapshot

/**
 * Fetches all questions from the question bank.
 * This is the function that was missing.
 */
export const getQuestions = async (): Promise<Question[]> => {
  const db = getFirestore();
  const questionsCol = collection(db, 'questionBank');
  const questionSnapshot = await getDocs(questionsCol);
  if (questionSnapshot.empty) {
    console.warn("Warning: Question bank is empty or not accessible.");
    return [];
  }
  return questionSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Question);
};


/**
 * This is the NEW client-side function that triggers the server-side Cloud Function.
 */
export async function generateExamVariants(examId: string): Promise<{ success: boolean; message: string; logs?: string[] }> {
  const functions = getFunctions();
  const generateVariantsCallable = httpsCallable(functions, 'generateExamVariantsHttps');

  try {
    console.log(`Calling cloud function 'generateExamVariantsHttps' with examId: ${examId}`);
    const result = await generateVariantsCallable({ examId });
    const data = result.data as { success: boolean; message: string; logs?: string[] };
    console.log('Cloud function returned:', data);
    return data;
  } catch (error: any) {
    console.error("Error calling cloud function:", error);
    const message = error.details?.message || error.message || 'Đã xảy ra lỗi không xác định.';
    return { success: false, message: `Lỗi từ server: ${message}` };
  }
}

// Other Firestore service functions remain unchanged
export const getExams = async () => {
  const db = getFirestore();
  const examsCol = collection(db, 'exams');
  const examSnapshot = await getDocs(examsCol);
  // Ánh xạ dữ liệu và đảm bảo các thuộc tính `snapshotVariantIds` và `variants`
  return examSnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    // Đảm bảo snapshotVariantIds là một mảng string
    const snapshotVariantIds = Array.isArray((data as any).snapshotVariantIds)
      ? (data as any).snapshotVariantIds as string[]
      : [];

    return {
      ...(data as Record<string, unknown>), // spread các thuộc tính còn lại
      id: docSnap.id,
      snapshotVariantIds,
      // Đảm bảo `variants` là number, nếu không có thì lấy độ dài của snapshotVariantIds
      variants: typeof (data as any).variants === 'number' ? (data as any).variants : snapshotVariantIds.length || 0,
    } as Exam;
  });
};

export const saveExam = async (exam: Omit<Exam, 'id'>) => {
    const db = getFirestore();
    // Khi tạo mới, isSynced là false, lastSyncedAt là null, snapshotVariantIds là rỗng
    const newExamData = { ...exam, isSynced: false, lastSyncedAt: null, snapshotVariantIds: [] };
    return await addDoc(collection(db, 'exams'), newExamData);
}

export const updateExam = async (examId: string, exam: Partial<Exam>) => {
    const db = getFirestore();
    // Khi cập nhật, cũng có thể reset trạng thái đồng bộ
    // (tùy thuộc vào business logic của bạn, có thể bạn muốn giữ trạng thái nếu chỉ update title)
    // Bản vá này reset isSynced, lastSyncedAt, snapshotVariantIds
    const updateData = { ...exam, isSynced: false, lastSyncedAt: null, snapshotVariantIds: [] }; // Reset sync status on update
    return await updateDoc(doc(db, 'exams', examId), updateData);
}

export const deleteExamWithVariants = async (examId: string) => {
    const db = getFirestore();
    const batch = writeBatch(db);

    // Xóa tất cả các snapshot biến thể liên quan đến bài thi này
    const variantsQuery = query(collection(db, 'examSnapshots'), where('examId', '==', examId));
    const variantsSnapshot = await getDocs(variantsQuery);
    variantsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    // Xóa tài liệu bài thi chính
    const examRef = doc(db, 'exams', examId);
    batch.delete(examRef);

    await batch.commit(); // Thực hiện batch delete
}

/**
 * Lấy tất cả các snapshot biến thể của một bài thi cụ thể từ collection 'examSnapshots'.
 * Sắp xếp theo thuộc tính 'variant' để đảm bảo thứ tự.
 */
export const getExamVariantSnapshots = async (examId: string): Promise<ExamVariantSnapshot[]> => {
  const db = getFirestore();
  // Tạo truy vấn để lấy các snapshot có examId khớp
  const variantsQuery = query(collection(db, 'examSnapshots'), where('examId', '==', examId));
  const snapshot = await getDocs(variantsQuery);

  // Ánh xạ các tài liệu thành kiểu ExamVariantSnapshot và sắp xếp
  return snapshot.docs
    .map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as Omit<ExamVariantSnapshot, 'id'>) }))
    .sort((a, b) => (a.variant || 0) - (b.variant || 0)); // Sắp xếp theo thuộc tính 'variant'
};