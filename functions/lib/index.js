"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExamVariantsHttps = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}
// *** DEFINITIVE FIX: Explicitly set the region to us-central1 ***
// This ensures the function is deployed to the same region the client SDK expects by default, resolving the 404 error.
exports.generateExamVariantsHttps = functions.region("us-central1").https.onCall(async (data, context) => {
    const examId = data.examId;
    const db = admin.firestore();
    const logs = [];
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
        const exam = examSnap.data();
        logs.push(`Processing exam: ${exam.title}`);
        const questionsCollection = db.collection('questionBank');
        const qSnapshot = await questionsCollection.get();
        if (qSnapshot.empty) {
            logs.push("Error: Question bank is empty.");
            throw new functions.https.HttpsError('failed-precondition', 'Ngân hàng câu hỏi trống.');
        }
        const questionBank = qSnapshot.docs.map(doc => (Object.assign(Object.assign({}, doc.data()), { id: doc.id })));
        logs.push(`Loaded ${questionBank.length} questions.`);
        let blueprint;
        try {
            blueprint = typeof exam.blueprint === 'string' ? JSON.parse(exam.blueprint) : exam.blueprint;
        }
        catch (e) {
            logs.push(`Error: Blueprint is invalid JSON. Content: ${exam.blueprint}`);
            throw new functions.https.HttpsError('invalid-argument', 'Ma trận (blueprint) không phải là một chuỗi JSON hợp lệ.');
        }
        if (!blueprint || !Array.isArray(blueprint) || blueprint.length === 0) {
            logs.push("Error: Blueprint is empty or not an array.");
            throw new functions.https.HttpsError('failed-precondition', 'Ma trận (blueprint) trống hoặc không hợp lệ.');
        }
        const selectedQuestions = [];
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
        const variantIds = [];
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
                totalPoints: shuffledQuestions.reduce((sum, q) => sum + (q.points || 1), 0),
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
    }
    catch (error) {
        console.error("FATAL ERROR in generateExamVariantsHttps:", error);
        logs.push(`FATAL: ${error.message}`);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', error.message || 'An unknown internal error occurred.', { logs });
    }
});
//# sourceMappingURL=index.js.map