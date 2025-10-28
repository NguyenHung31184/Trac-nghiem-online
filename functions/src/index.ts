
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

// Interface for student data from the client
interface StudentData {
  email: string;
  fullName: string;
  classId: string;
}

// Interface for the result of processing a single student
interface ProcessResult {
  email: string;
  success: boolean;
  message: string;
}

export const bulkCreateUsers = functions.region("us-central1").https.onCall(async (data, context) => {
  // 1. Authorization Check: Ensure the user is an admin
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Chỉ quản trị viên mới có thể thực hiện chức năng này.'
    );
  }

  // 2. Input Validation
  const students = data.students as StudentData[];
  if (!Array.isArray(students) || students.length === 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Dữ liệu đầu vào phải là một mảng học sinh và không được rỗng.'
    );
  }

  const results: ProcessResult[] = [];
  const db = admin.firestore();

  for (const student of students) {
    const { email, fullName, classId } = student;

    // Validate each student object
    if (!email || !fullName || !classId) {
        results.push({
            email: email || 'N/A',
            success: false,
            message: 'Dữ liệu không hợp lệ (thiếu email, họ tên hoặc mã lớp).',
        });
        continue; // Skip to the next student
    }

    try {
      // 3. Create user in Firebase Authentication
      const userRecord = await admin.auth().createUser({
        email: email,
        password: email, // Set password to be the email for the first login
        displayName: fullName,
      });

      // 4. Create user profile in Firestore 'students' collection
      await db.collection('students').doc(userRecord.uid).set({
        email: email,
        name: fullName,
        role: 'student',
        classIds: [classId], // Store classId in an array
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Set custom claim for role-based access control
      await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'student' });
      
      results.push({
        email: email,
        success: true,
        message: 'Tạo tài khoản thành công.',
      });

    } catch (error: any) {
      let message = 'Lỗi không xác định.';
      if (error.code === 'auth/email-already-exists') {
        message = 'Email đã tồn tại.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Email không hợp lệ.';
      } else {
        console.error(`Lỗi khi tạo tài khoản cho ${email}:`, error);
        message = error.message;
      }
      
      results.push({
        email: email,
        success: false,
        message: message,
      });
    }
  }

  // 6. Return the detailed results to the client
  return { results };
});


// --- EXISTING CODE ---

interface Question {
  id: string; 
  questionText: string;
  options: string[];
  correctAnswer: string;
  points?: number;
  topic?: string;
  difficulty?: string;
  imageUrl?: string;
}

interface BlueprintRule {
  count: number;
  topic: string;
  difficulty: string;
}

function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

export const generateExamVariantsHttps = functions.region("us-central1").https.onCall(async (data, context) => {
    const examId = data.examId as string;
    const db = admin.firestore();
    const logs: string[] = [];

    logs.push(`Function start. examId: ${examId}`);

    if (!examId) {
        logs.push("Error: examId not provided.");
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with an "examId".', { logs });
    }

    try {
        const examRef = db.doc(`exams/${examId}`);
        const examSnap = await examRef.get();
        if (!examSnap.exists) {
            logs.push(`Error: Exam with ID ${examId} not found.`);
            throw new functions.https.HttpsError('not-found', `Bài thi với ID ${examId} không tồn tại.`);
        }
        const exam = examSnap.data()!;
        logs.push(`Processing exam: ${exam.title}`);

        const questionsCollection = db.collection('questionBank');
        const qSnapshot = await questionsCollection.get();
        if (qSnapshot.empty) {
            logs.push("Error: Question bank is empty.");
            throw new functions.https.HttpsError('failed-precondition', 'Ngân hàng câu hỏi trống.');
        }
        
        const questionBank = qSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Question);
        logs.push(`Loaded ${questionBank.length} questions.`);

        let blueprint: BlueprintRule[];
        try {
            blueprint = typeof exam.blueprint === 'string' ? JSON.parse(exam.blueprint) : exam.blueprint;
        } catch (e) {
            logs.push(`Error: Blueprint is invalid JSON. Content: ${exam.blueprint}`);
            throw new functions.https.HttpsError('invalid-argument', 'Ma trận (blueprint) không phải là một chuỗi JSON hợp lệ.');
        }

        if (!blueprint || !Array.isArray(blueprint) || blueprint.length === 0) {
            logs.push("Error: Blueprint is empty or not an array.");
            throw new functions.https.HttpsError('failed-precondition', 'Ma trận (blueprint) trống hoặc không hợp lệ.');
        }

        const selectedQuestions: Question[] = [];
        let availableQuestions = [...questionBank];

        for (const rule of blueprint) {
            const { count, topic, difficulty } = rule;
            logs.push(`Applying rule: ${count} questions, Topic: ${topic}, Difficulty: ${difficulty}.`);

            const matches = availableQuestions.filter(q => q.topic === topic && q.difficulty === difficulty);

            if (matches.length < count) {
                const errorMsg = `Không đủ câu hỏi! Chủ đề: '${topic}', Độ khó: '${difficulty}'. Yêu cầu: ${count}, Chỉ có: ${matches.length}.`;
                logs.push(`Error: ${errorMsg}`);
                throw new functions.https.HttpsError('failed-precondition', errorMsg);
            }

            const picked = shuffle(matches).slice(0, count);
            selectedQuestions.push(...picked);

            availableQuestions = availableQuestions.filter(q => !picked.some(p => p.id === q.id));
        }
        logs.push(`Successfully selected ${selectedQuestions.length} unique questions.`);

        const batch = db.batch();
        const variantIds: string[] = [];
        const variantsToCreate = exam.variants > 0 ? exam.variants : 1;

        for (let i = 1; i <= variantsToCreate; i++) {
            const shuffledQuestions = shuffle(selectedQuestions);
            const snapshotRef = db.collection('examSnapshots').doc();

            batch.set(snapshotRef, {
                examId: examId,
                examTitle: exam.title,
                variant: i,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                questions: shuffledQuestions,
                totalPoints: shuffledQuestions.reduce((sum: number, q) => sum + (q.points || 1), 0),
                duration: exam.duration,
            });
            variantIds.push(snapshotRef.id);
        }
        logs.push(`Prepared ${variantsToCreate} variants for batch commit.`);

        batch.update(examRef, {
            snapshotVariantIds: variantIds,
            isSynced: true,
            lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await batch.commit();
        logs.push(`Batch commit successful.`);

        return { 
            success: true, 
            message: `Hoàn tất! Đồng bộ thành công: ${exam.title}. Đã tạo ${variantsToCreate} biến thể.`,
            logs: logs 
        };

    } catch (error: any) {
        console.error("FATAL ERROR in generateExamVariantsHttps:", error);
        logs.push(`FATAL: ${error.message}`);
        if (error instanceof functions.https.HttpsError) {
            throw error; 
        }
        throw new functions.https.HttpsError('internal', error.message || 'An unknown internal error occurred.', { logs });
    }
});
