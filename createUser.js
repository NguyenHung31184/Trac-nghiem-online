
const admin = require('firebase-admin');
const fs = require('fs');
const csv = require('csv-parser');

// =========================================================================================
// !!! QUAN TRỌNG: BƯỚC 1 - CUNG CẤP KEY BẢO MẬT
// 1. Vào Firebase Console -> Project Settings -> Service accounts.
// 2. Nhấn nút "Generate new private key" và tải file .json về.
// 3. Đặt file đó vào thư mục gốc của dự án.
// 4. Đổi tên file đó thành "serviceAccountKey.json".
// 5. ĐẢM BẢO BẠN ĐÃ THÊM "serviceAccountKey.json" VÀO FILE .gitignore CỦA BẠN.
// =========================================================================================
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (error) {
    console.error('LỖI: Không tìm thấy file "serviceAccountKey.json". Vui lòng làm theo hướng dẫn trong file createUser.js để tạo và đặt file này vào đúng vị trí.');
    process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

const DEFAULT_PASSWORD = '123456';

// =========================================================================================
// !!! QUAN TRỌNG: BƯỚC 2 - CHUẨN BỊ DỮ LIỆU
// 1. Đổi tên file "students_example.csv" thành "students.csv".
// 2. Mở file "students.csv" và điền dữ liệu học sinh của bạn.
// 3. Các cột cần thiết: email, fullName, classId.
// 4. Cột "password" là tùy chọn; nếu bỏ trống, mật khẩu mặc định sẽ là "123456".
// =========================================================================================
const filePath = './students.csv';

if (!fs.existsSync(filePath)) {
    console.error(`LỖI: Không tìm thấy file "${filePath}". Bạn đã đổi tên file "students_example.csv" thành "students.csv" chưa?`);
    process.exit(1);
}

console.log('Bắt đầu quá trình đồng bộ hóa tài khoản và hồ sơ hàng loạt...');

fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', async (row) => {
    // Lấy dữ liệu từ mỗi hàng, loại bỏ khoảng trắng thừa
    const email = row.email?.trim();
    const password = row.password?.trim();
    const fullName = row.fullName?.trim();
    const classId = row.classId?.trim();

    if (!email || !fullName || !classId) {
      console.warn('CẢNH BÁO: Bỏ qua hàng không hợp lệ (thiếu email, fullName, hoặc classId):', row);
      return;
    }

    try {
        let userRecord;
        // Kiểm tra xem người dùng đã tồn tại trong Firebase Authentication chưa
        try {
            userRecord = await auth.getUserByEmail(email);
            console.log(`[Auth] ✔ Người dùng ${email} đã tồn tại.`);

            if (password) {
                await auth.updateUser(userRecord.uid, {
                    password,
                    displayName: fullName
                });
                console.log(`[Auth] 🔁 Đã cập nhật mật khẩu cho người dùng: ${email}`);
            }
        } catch (error) {
            // Nếu người dùng không được tìm thấy, hãy tạo một người dùng mới
            if (error.code === 'auth/user-not-found') {
                console.log(`[Auth] ⚠ Người dùng ${email} chưa tồn tại. Đang tiến hành tạo...`);
                const initialPassword = password || DEFAULT_PASSWORD;
                userRecord = await auth.createUser({ email, password: initialPassword, displayName: fullName });
                console.log(`[Auth] ✔ Tạo tài khoản mới thành công cho: ${email}`);
                if (!password) {
                    console.log(`[Auth] 🔐 Đã sử dụng mật khẩu mặc định cho ${email}: ${DEFAULT_PASSWORD}`);
                }
            } else {
                throw error; // Gửi lại các lỗi xác thực khác
            }
        }

        // Tại thời điểm này, chúng ta có một userRecord. Bây giờ, hãy tạo tài liệu Firestore nếu nó không tồn tại.
        const studentDocRef = db.collection('students').doc(userRecord.uid);
        const studentDoc = await studentDocRef.get();

        if (studentDoc.exists) {
            console.log(`[Firestore] ✔ Hồ sơ cho ${fullName} đã tồn tại, bỏ qua.`);
        } else {
            await studentDocRef.set({
                email: userRecord.email,
                fullName: fullName,
                role: 'student',
                classIds: [classId]
            });
            console.log(`[Firestore] ✔ Tạo hồ sơ Firestore thành công cho: ${fullName}`);
        }

    } catch (error) {
        console.error(`[Lỗi] ❌ Xảy ra lỗi không mong muốn khi xử lý ${fullName} (${email}):`, error.message);
    }
  })
  .on('end', () => {
    console.log('\n🎉 Hoàn tất quá trình đồng bộ hóa tài khoản và hồ sơ!');
  });
