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
import type { Exam, Question } from '../types';

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
  return examSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Exam);
};

export const saveExam = async (exam: Omit<Exam, 'id'>) => {
    const db = getFirestore();
    const newExamData = { ...exam, isSynced: false, lastSyncedAt: null, snapshotVariantIds: [] };
    return await addDoc(collection(db, 'exams'), newExamData);
}

export const updateExam = async (examId: string, exam: Partial<Exam>) => {
    const db = getFirestore();
    const updateData = { ...exam, isSynced: false, lastSyncedAt: null, snapshotVariantIds: [] }; // Reset sync status on update
    return await updateDoc(doc(db, 'exams', examId), updateData);
}

export const deleteExamWithVariants = async (examId: string) => {
    const db = getFirestore();
    const batch = writeBatch(db);

    const variantsQuery = query(collection(db, 'examSnapshots'), where('examId', '==', examId));
    const variantsSnapshot = await getDocs(variantsQuery);
    variantsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    const examRef = doc(db, 'exams', examId);
    batch.delete(examRef);

    await batch.commit();
}
