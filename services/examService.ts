import type {
  Exam,
  Question,
  Attempt,
  AuditLog,
  User,
  QuestionWithExamDetails,
  Class,
  ExamWindow,
  ExamVariantSnapshot,
} from '../types';
import { db } from './firebase';
import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  getDocs,
  getDoc,
  query,
  where,
  limit,
  orderBy,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentSnapshot, DocumentData } from 'firebase/firestore';

type AdminDashboardData = {
  students: User[];
  questions: QuestionWithExamDetails[];
  exams: Exam[];
  windows: ExamWindow[];
  classes: Class[];
  qbankCount: number;
};

export type UserProfile = {
  name: string;
  email: string;
  classIds: string[];
};

export type ExamVariant = {
  examId: string;
  variant: number;
  url: string;
  questions?: Question[];
};

export type ExamAnalyticsData = {
  questionAnalytics: Question[];
};

const chunkArray = <T,>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const removeUndefined = <T extends Record<string, unknown>>(input: T): T => {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as T;
};

const timestampToMillis = (value: unknown): number => {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value && typeof value === 'object' && 'seconds' in (value as any)) {
    const seconds = Number((value as any).seconds ?? 0);
    const nanos = Number((value as any).nanoseconds ?? 0);
    return seconds * 1000 + Math.floor(nanos / 1_000_000);
  }
  return 0;
};

const normalizePassThresholdInput = (value: unknown): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return value > 1 ? value / 100 : value;
};

const toPersistableBlueprint = (value: Exam['blueprint']): Exam['blueprint'] => {
  if (!value) {
    return value;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const toTimestamp = (value: number | Timestamp | null | undefined): Timestamp => {
  if (value instanceof Timestamp) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Timestamp.fromMillis(value);
  }
  throw new Error('Giá trị thời gian không hợp lệ.');
};

const mapExamDocument = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): Exam => {
  const data = docSnap.data() as any;
  const rawPassThreshold =
    typeof data.pass_threshold === 'number'
      ? data.pass_threshold
      : Number(data.passThreshold ?? data.passThresholdPercent ?? 0);
  const normalizedPassThreshold = Number.isFinite(rawPassThreshold)
    ? rawPassThreshold > 1
      ? rawPassThreshold / 100
      : rawPassThreshold
    : 0;

  const rawBlueprint = data.blueprint ?? data.examBlueprint;
  let blueprintValue: Exam['blueprint'] = rawBlueprint;
  if (typeof rawBlueprint === 'string') {
    try {
      blueprintValue = JSON.parse(rawBlueprint);
    } catch (parseError) {
      console.warn('[examService] Không thể parse blueprint từ Firestore:', parseError);
      blueprintValue = rawBlueprint;
    }
  }

  const snapshotVariantIds = Array.isArray(data.snapshotVariantIds) ? data.snapshotVariantIds : [];

  const variants =
    typeof data.variants === 'number'
      ? data.variants
      : Array.isArray(snapshotVariantIds)
        ? snapshotVariantIds.length
        : undefined;

  return {
    id: docSnap.id,
    title: data.title || '',
    description: data.description || '',
    duration: Number(data.duration) || 0,
    pass_threshold: normalizedPassThreshold,
    totalQuestions: Number(data.totalQuestions ?? data.totalQuestionCount ?? 0) || 0,
    blueprint: blueprintValue,
    variants,
    questionsSnapshotUrl: data.questionsSnapshotUrl,
    snapshotVariantIds,
    isSynced: data.isSynced ?? false,
    lastSyncedAt: data.lastSyncedAt ?? null,
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    questions: Array.isArray(data.questions) ? data.questions : undefined,
  } as Exam;
};

const mapQuestionDocument = (
  docSnap: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): QuestionWithExamDetails => {
  const data = docSnap.data() as QuestionWithExamDetails;
  return {
    ...data,
    id: docSnap.id,
  };
};

const fetchAdminDashboardDataFromFirestore = async (): Promise<AdminDashboardData> => {
  const [studentsSnap, classesSnap, examsSnap, windowsSnap, questionSnap] = await Promise.all([
    getDocs(collection(db, 'students')),
    getDocs(collection(db, 'classes')),
    getDocs(collection(db, 'exams')),
    getDocs(collection(db, 'examWindows')),
    getDocs(collection(db, 'questionBank')),
  ]);

  const students: User[] = studentsSnap.docs.map((docSnap) => {
    const data = docSnap.data() as any;
    const roles = Array.isArray(data.roles) ? data.roles : (data.role ? [data.role] : ['student']);
    return {
      id: docSnap.id,
      name: data.name || data.fullName || '',
      email: data.email || '',
      roles,
      role: roles[0],
      classIds: Array.isArray(data.classIds) ? data.classIds : [],
    };
  });

  const classes: Class[] = classesSnap.docs.map((docSnap) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      name: data.name || data.className || '',
    };
  });

  const exams: Exam[] = examsSnap.docs.map(mapExamDocument);

  const windows: ExamWindow[] = windowsSnap.docs.map((docSnap) => {
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      examId: data.examId,
      classId: data.classId,
      start_at: timestampToMillis(data.start_at),
      end_at: timestampToMillis(data.end_at),
      accessCode: data.accessCode,
    };
  });

  const questions: QuestionWithExamDetails[] = questionSnap.docs.map(mapQuestionDocument);

  return {
    students,
    exams,
    windows,
    classes,
    questions,
    qbankCount: questionSnap.size,
  };
};

const fetchUserProfileFromFirestore = async (email: string): Promise<UserProfile> => {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email không hợp lệ.');
  }

  const studentsRef = collection(db, 'students');
  const q = query(studentsRef, where('email', '==', normalizedEmail), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) {
    throw new Error('Không tìm thấy hồ sơ học viên trong Firestore.');
  }

  const data = snap.docs[0].data() as any;
  return {
    name: data.name || data.fullName || normalizedEmail,
    email: data.email || normalizedEmail,
    classIds: Array.isArray(data.classIds) ? data.classIds : [],
  };
};

const fetchExamWindowsForClassesFromFirestore = async (
  classIds: string[],
): Promise<(ExamWindow & { exam: Exam })[]> => {
  if (!classIds || classIds.length === 0) {
    return [];
  }

  const windows: ExamWindow[] = [];
  const windowsRef = collection(db, 'examWindows');

  for (const chunk of chunkArray(classIds, 10)) {
    const windowsQuery = query(windowsRef, where('classId', 'in', chunk));
    const snap = await getDocs(windowsQuery);
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      windows.push({
        id: docSnap.id,
        examId: data.examId,
        classId: data.classId,
        start_at: timestampToMillis(data.start_at),
        end_at: timestampToMillis(data.end_at),
        accessCode: data.accessCode,
      });
    });
  }

  if (windows.length === 0) {
    return [];
  }

  const examIds = Array.from(new Set(windows.map((w) => w.examId).filter(Boolean)));
  const examMap = new Map<string, Exam>();

  await Promise.all(
    examIds.map(async (examId) => {
      const examSnap = await getDoc(doc(db, 'exams', examId));
      if (examSnap.exists()) {
        examMap.set(examId, mapExamDocument(examSnap));
      }
    }),
  );

  return windows
    .filter((window) => examMap.has(window.examId))
    .map((window) => ({
      ...window,
      exam: examMap.get(window.examId)!,
    }))
    .sort((a, b) => b.start_at - a.start_at);
};

const hashString = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const fetchExamVariantForStudentFromFirestore = async (
  examId: string,
  studentEmail: string,
): Promise<ExamVariant> => {
  const snapshotsRef = collection(db, 'examSnapshots');
  const snapshotsSnap = await getDocs(query(snapshotsRef, where('examId', '==', examId)));

  if (snapshotsSnap.empty) {
    throw new Error('Chưa có biến thể nào cho bài thi này. Vui lòng chạy đồng bộ biến thể.');
  }

  const variants = snapshotsSnap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as ExamVariantSnapshot),
    }))
    .sort((a, b) => (a.variant ?? 0) - (b.variant ?? 0));

  const variantIndex = hashString(`${studentEmail.toLowerCase()}::${examId}`) % variants.length;
  const chosenVariant = variants[variantIndex];

  return {
    examId,
    variant: chosenVariant.variant ?? variantIndex + 1,
    url: '',
    questions: Array.isArray(chosenVariant.questions) ? chosenVariant.questions : [],
  };
};

const fetchExamAnalyticsFromFirestore = async (examId: string): Promise<ExamAnalyticsData> => {
  const questionsQuery = query(collection(db, 'questionBank'), where('examId', '==', examId));
  const questionsSnap = await getDocs(questionsQuery);
  const questionAnalytics = questionsSnap.docs.map(mapQuestionDocument);
  return { questionAnalytics };
};

const createExamInFirestore = async (exam: Omit<Exam, 'id'>): Promise<Exam> => {
  const payload = removeUndefined({
    title: exam.title,
    description: exam.description ?? '',
    duration: exam.duration ?? 0,
    pass_threshold: normalizePassThresholdInput(exam.pass_threshold),
    totalQuestions: exam.totalQuestions ?? 0,
    blueprint: toPersistableBlueprint(exam.blueprint),
    variants: typeof exam.variants === 'number' ? exam.variants : undefined,
    questionsSnapshotUrl: exam.questionsSnapshotUrl ?? undefined,
    snapshotVariantIds: Array.isArray(exam.snapshotVariantIds) ? exam.snapshotVariantIds : [],
    isSynced: false,
    lastSyncedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const docRef = await addDoc(collection(db, 'exams'), payload);
  const snap = await getDoc(docRef);
  return mapExamDocument(snap);
};

const updateExamInFirestore = async (exam: Exam): Promise<void> => {
  const examRef = doc(db, 'exams', exam.id);
  const payload = removeUndefined({
    title: exam.title,
    description: exam.description,
    duration: exam.duration,
    pass_threshold: normalizePassThresholdInput(exam.pass_threshold),
    totalQuestions: exam.totalQuestions,
    blueprint: toPersistableBlueprint(exam.blueprint),
    variants: typeof exam.variants === 'number' ? exam.variants : undefined,
    questionsSnapshotUrl: exam.questionsSnapshotUrl,
    snapshotVariantIds: Array.isArray(exam.snapshotVariantIds) ? exam.snapshotVariantIds : [],
    isSynced: false,
    lastSyncedAt: null,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(examRef, payload);
};

const deleteExamInFirestore = async (examId: string): Promise<void> => {
  const examRef = doc(db, 'exams', examId);
  const snapshotsQuery = query(collection(db, 'examSnapshots'), where('examId', '==', examId));
  const windowsQuery = query(collection(db, 'examWindows'), where('examId', '==', examId));

  const [snapshotsSnap, windowsSnap] = await Promise.all([
    getDocs(snapshotsQuery),
    getDocs(windowsQuery),
  ]);

  const batch = writeBatch(db);
  snapshotsSnap.forEach((docSnap) => batch.delete(docSnap.ref));
  windowsSnap.forEach((docSnap) => batch.delete(docSnap.ref));
  batch.delete(examRef);
  await batch.commit();
};

const addQuestionToFirestore = async (
  examId: string,
  question: Omit<Question, 'id' | 'analytics'>,
): Promise<Question> => {
  const payload = removeUndefined({
    ...question,
    examId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const docRef = await addDoc(collection(db, 'questionBank'), payload);
  const snap = await getDoc(docRef);
  const persisted = snap.data() as Question | undefined;
  return {
    id: docRef.id,
    examId,
    ...(persisted ?? (question as Question)),
  };
};

const updateQuestionInFirestore = async (question: QuestionWithExamDetails): Promise<void> => {
  if (!question.id) {
    throw new Error('Thiếu ID câu hỏi cần cập nhật.');
  }
  const questionRef = doc(db, 'questionBank', question.id);
  const { id, analytics, ...rest } = question;
  const payload = removeUndefined({
    ...rest,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(questionRef, payload);
};

const deleteQuestionFromFirestore = async (questionId: string): Promise<void> => {
  await deleteDoc(doc(db, 'questionBank', questionId));
};

const createWindowInFirestore = async (windowData: Omit<ExamWindow, 'id'>): Promise<ExamWindow> => {
  const payload = removeUndefined({
    examId: windowData.examId,
    classId: windowData.classId,
    accessCode: windowData.accessCode,
    start_at: toTimestamp(windowData.start_at),
    end_at: toTimestamp(windowData.end_at),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const newWindowRef = await addDoc(collection(db, 'examWindows'), payload);
  return {
    id: newWindowRef.id,
    examId: windowData.examId,
    classId: windowData.classId,
    start_at: windowData.start_at,
    end_at: windowData.end_at,
    accessCode: windowData.accessCode,
  };
};

// =================================================================================
// ======================== TẢI DỮ LIỆU TĨNH "HOT PATH" ============================
// =================================================================================

export const fetchQuestionsFromSnapshot = async (url: string): Promise<Question[]> => {
  if (!url) {
    console.error('fetchQuestionsFromSnapshot called with no URL.');
    return [];
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const snapshotData: { questions?: Question[] } = await response.json();
    return snapshotData.questions || [];
  } catch (error) {
    console.error('Failed to fetch or parse question snapshot:', error);
    throw new Error(
      `Không thể tải hoặc phân tích file câu hỏi từ URL: ${url}. Lỗi gốc: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

// =================================================================================
// ========================== FIREBASE "HOT PATH" FUNCTIONS ========================
// =================================================================================

export const createAttempt = async (userId: string, examId: string, windowId: string): Promise<Attempt> => {
  const attemptId = `atm_${Date.now()}`;
  const newAttempt: Attempt = {
    id: attemptId,
    userId,
    examId,
    windowId,
    status: 'in-progress',
    answers: {},
    score: null,
    started_at: Date.now(),
    completed_at: null,
    reviewRequested: false,
  };

  const attemptRef = doc(db, 'attempts', attemptId);
  await setDoc(attemptRef, { ...newAttempt, started_at: serverTimestamp() });

  return newAttempt;
};

export const saveAnswer = async (attemptId: string, answers: { [questionId: string]: string }): Promise<void> => {
  const attemptRef = doc(db, 'attempts', attemptId);
  await updateDoc(attemptRef, {
    answers,
    updatedAt: serverTimestamp(),
  });
};

export const submitAttempt = async (attempt: Attempt): Promise<Attempt> => {
  const attemptRef = doc(db, 'attempts', attempt.id);
  const questionCount = attempt.questions?.length ?? 0;
  let computedScore = attempt.score ?? null;

  if (questionCount > 0) {
    const correctCount = attempt.questions!.reduce((total, question) => {
      return total + (attempt.answers[question.id] === question.answer_key ? 1 : 0);
    }, 0);
    computedScore = questionCount > 0 ? correctCount / questionCount : null;
  }

  const finalAttemptData: Attempt = {
    ...attempt,
    status: 'completed',
    completed_at: Date.now(),
    score: computedScore,
  };

  await updateDoc(attemptRef, {
    status: 'completed',
    completed_at: serverTimestamp(),
    answers: attempt.answers,
    score: computedScore,
    questions: attempt.questions || [],
    updatedAt: serverTimestamp(),
  });

  return finalAttemptData;
};

export const logAuditEvent = async (log: Omit<AuditLog, 'id'>): Promise<void> => {
  const logsCollectionRef = collection(db, `attempts/${log.attemptId}/audit_logs`);
  const dataToSave: { [key: string]: any } = {
    ...log,
    timestamp: serverTimestamp(),
  };
  if (dataToSave.metadata === undefined) {
    delete dataToSave.metadata;
  }
  await addDoc(logsCollectionRef, dataToSave);
};

export const requestAttemptReview = async (attemptId: string): Promise<void> => {
  const attemptRef = doc(db, 'attempts', attemptId);
  await updateDoc(attemptRef, {
    reviewRequested: true,
    updatedAt: serverTimestamp(),
  });
};

// =================================================================================
// ============================ FIREBASE DATA FUNCTIONS ============================
// =================================================================================

export const getUserProfile = async (email: string): Promise<UserProfile> => {
  return fetchUserProfileFromFirestore(email);
};

export const getAvailableWindowsForUser = async (
  user: User,
): Promise<(ExamWindow & { exam: Exam })[]> => {
  return fetchExamWindowsForClassesFromFirestore(user.classIds ?? []);
};

export const getExamVariantForStudent = async (
  examId: string,
  studentEmail: string,
): Promise<ExamVariant> => {
  return fetchExamVariantForStudentFromFirestore(examId, studentEmail);
};

export const getAdminDashboardData = async (): Promise<AdminDashboardData> => {
  return fetchAdminDashboardDataFromFirestore();
};

export const addClass = async (className: string): Promise<Class> => {
  const newClassRef = await addDoc(collection(db, 'classes'), {
    name: className,
    createdAt: serverTimestamp(),
  });
  return { id: newClassRef.id, name: className };
};

export const updateClass = async (classData: Class): Promise<void> => {
  await updateDoc(doc(db, 'classes', classData.id), {
    name: classData.name,
    updatedAt: serverTimestamp(),
  });
};

export const addExam = async (exam: Omit<Exam, 'id'>): Promise<Exam> => {
  return createExamInFirestore(exam);
};

export const updateExam = async (exam: Exam): Promise<void> => {
  await updateExamInFirestore(exam);
};

export const deleteExam = async (examId: string): Promise<void> => {
  await deleteExamInFirestore(examId);
};

export const addWindow = async (windowData: Omit<ExamWindow, 'id'>): Promise<ExamWindow> => {
  return createWindowInFirestore(windowData);
};

export const addQuestion = async (
  examId: string,
  question: Omit<Question, 'id' | 'analytics'>,
): Promise<Question> => {
  return addQuestionToFirestore(examId, question);
};

export const updateQuestion = async (question: QuestionWithExamDetails): Promise<void> => {
  await updateQuestionInFirestore(question);
};

export const deleteQuestion = async (questionId: string): Promise<void> => {
  await deleteQuestionFromFirestore(questionId);
};

export const getExamAnalytics = async (examId: string): Promise<ExamAnalyticsData> => {
  return fetchExamAnalyticsFromFirestore(examId);
};

export const getAllAttemptsFromFirestore = async (): Promise<Attempt[]> => {
  const attemptsCollection = collection(db, 'attempts');
  const q = query(attemptsCollection, orderBy('started_at', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      ...(data as Attempt),
      id: docSnap.id,
      started_at: timestampToMillis(data.started_at),
      completed_at: data.completed_at ? timestampToMillis(data.completed_at) : null,
    } as Attempt;
  });
};

export const getAttemptAuditLogs = async (attemptId: string): Promise<AuditLog[]> => {
  const logsCollection = collection(db, `attempts/${attemptId}/audit_logs`);
  const q = query(logsCollection, orderBy('timestamp', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      ...(data as AuditLog),
      id: docSnap.id,
      timestamp: timestampToMillis(data.timestamp),
    } as AuditLog;
  });
};
