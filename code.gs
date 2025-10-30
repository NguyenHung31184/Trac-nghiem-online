/***** =========[ PROCTORFREE – GAS BACKOFFICE (GCS + CORS, ONE-FILE) ]========= *
 * Kiến trúc hiện tại (HYBRID – GCS + VARIANTS):
 *   - Admin bấm “Đồng bộ” → sinh N biến thể/snapshot lên GCS (public), answer-key vào bucket private.
 *   - Khi SV bắt đầu thi: FE gọi getExamVariantForStudent → nhận URL snapshot public theo biến thể.
 *   - FE có thể xáo thêm theo seed per-student, nhưng BE đã chuẩn hóa id phương án để chấm an toàn.
 *
 * Bổ sung:
 *   - “Độ khó tích lũy”: nếu thiếu bậc yêu cầu, tự lấy bậc dễ hơn theo ladder (config).
 *   - verifyExamBlueprint: dry-run kiểm tra blueprint + báo cáo fallback/thiếu.
 *******************************************************************************/

// ======================== CẤU HÌNH & NẠP CONFIG ===============================
const CONFIG_DEFAULT = {
  SPREADSHEET_ID: '',
  GCS_PUBLIC_BUCKET: '',
  GCS_PRIVATE_BUCKET: '',
  FIREBASE_PROJECT_ID: '',
  ANSWER_KEY_IN_QUESTION: true,
  DIFFICULTY_LADDER: '["Dễ","Trung bình","Khó"]', // easiest -> hardest
  ENABLE_DIFFICULTY_FALLBACK: true,
  FALLBACK_MAX_SHARE_PER_RULE: 1.0
};
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
function respond_(body, code) {
  const out = ContentService.createTextOutput(
    typeof body === 'string' ? body : JSON.stringify(body)
  ).setMimeType(ContentService.MimeType.JSON);
  Object.entries(CORS).forEach(([k,v]) => out.setHeader(k,v));
  return out;
}
function doOptions(e){ return respond_('', 204); }
function doGet(e){ return route_(e, 'GET'); }
function doPost(e){ return route_(e, 'POST'); }
function route_(e, method){
  const q = e.parameter || {};
  const payload = e.postData?.type === 'application/json'
      ? JSON.parse(e.postData.contents||'{}') : {};
  const action = (q.action || payload.action || '').trim();

  try{
    if(action === 'syncAndCreateSnapshots'){
      const data = syncAndCreateSnapshots(); // hàm của bạn
      return respond_({ok:true, data}, 200);
    }
    return respond_({ok:false, error:'Invalid action'}, 400);
  }catch(err){
    return respond_({ok:false, error:String(err)}, 500);
  }
}
function loadConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();
  const pick  = (k, def) => (props[k] ? props[k] : def);
  const bool  = (k, def) => (props[k] != null ? String(props[k]).toLowerCase() === 'true' : def);
  const num   = (k, def) => (props[k] != null ? Number(props[k]) : def);

  // Private key: hỗ trợ trường hợp dán một dòng có \n
  const rawKey = pick('GCS.PRIVATE_KEY', '');
  const normalizedKey = rawKey ? rawKey.replace(/\n/g, '\n') : '';

  return {
    SPREADSHEET_ID:         pick('CONFIG.SPREADSHEET_ID',        CONFIG_DEFAULT.SPREADSHEET_ID),
    GCS_PUBLIC_BUCKET:      pick('GCS.PUBLIC_BUCKET',             CONFIG_DEFAULT.GCS_PUBLIC_BUCKET),
    GCS_PRIVATE_BUCKET:     pick('GCS.PRIVATE_BUCKET',            CONFIG_DEFAULT.GCS_PRIVATE_BUCKET),
    FIREBASE_PROJECT_ID:    pick('CONFIG.FIREBASE_PROJECT_ID',    CONFIG_DEFAULT.FIREBASE_PROJECT_ID),
    ANSWER_KEY_IN_QUESTION: bool('CONFIG.ANSWER_KEY_IN_QUESTION', CONFIG_DEFAULT.ANSWER_KEY_IN_QUESTION),
    SA_EMAIL:               pick('GCS.SA_EMAIL', ''),
    SA_PRIVATE_KEY:         normalizedKey,

    DIFFICULTY_LADDER:      pick('CONFIG.DIFFICULTY_LADDER', CONFIG_DEFAULT.DIFFICULTY_LADDER),
    ENABLE_DIFFICULTY_FALLBACK: bool('CONFIG.ENABLE_DIFFICULTY_FALLBACK', CONFIG_DEFAULT.ENABLE_DIFFICULTY_FALLBACK),
    FALLBACK_MAX_SHARE_PER_RULE: num('CONFIG.FALLBACK_MAX_SHARE_PER_RULE', CONFIG_DEFAULT.FALLBACK_MAX_SHARE_PER_RULE)
  };
}
var CONFIG = loadConfig();

function _assertConfig_() {
  const misses = [];
  if (!CONFIG.SPREADSHEET_ID)    misses.push('CONFIG.SPREADSHEET_ID');
  if (!CONFIG.GCS_PUBLIC_BUCKET) misses.push('GCS.PUBLIC_BUCKET');
  if (!CONFIG.SA_EMAIL)          misses.push('GCS.SA_EMAIL');
  if (!CONFIG.SA_PRIVATE_KEY)    misses.push('GCS.PRIVATE_KEY');
  if (misses.length) throw new Error('Thiếu Script Properties: ' + misses.join(', '));
}

// =========================== HẰNG SỐ & ÁNH XẠ CỘT =============================
const SHEETS = { QBANK: 'QBank', CLASSES: 'Classes', EXAMS: 'Exams', STUDENTS: 'Students', WINDOWS: 'Windows' };
const PREFIX = { q: 'Q_', cls: 'CLS_', ex: 'EX_', win: 'WIN_' };

const QMAP = {
  id: ['ID Câu hỏi', 'ID'],
  stem: ['Câu hỏi', 'Câu hỏi (Nội dung chính)'],
  a: ['Đáp án A', 'A'],
  b: ['Đáp án B', 'B'],
  c: ['Đáp án C', 'C'],
  d: ['Đáp án D', 'D'],
  correctText: ['Đáp án đúng (chép lại nội dung)', 'Correct Text'],
  points: ['Điểm', 'Points'],
  topic: ['Chủ đề/Lớp/Ngành', 'Topic'],
  difficulty: ['Bậc/Độ khó', 'Bậc', 'Difficulty'],
  image: ['Link ảnh minh họa (nếu có)', 'Image Link'],
};

// ============================== CORS & JSON OUT ===============================
function _withCors(out) {
  try {
    out.setHeader('Access-Control-Allow-Origin', '*');
    out.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    out.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  } catch (_) {}
  return out;
}
function _jsonOK(data) {
  return _withCors(ContentService.createTextOutput(JSON.stringify({ ok: true, data }))
    .setMimeType(ContentService.MimeType.JSON));
}
function _jsonErr(error) {
  const msg = String(error && error.stack ? error.stack : (error && error.message || error || 'Unknown error'));
  return _withCors(ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON));
}
function doOptions(e) { return _withCors(ContentService.createTextOutput('')); }

// ================================= ROUTER =====================================
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    let data;
    switch (action) {
      case 'getAdminDashboardData':      _assertConfig_(); data = getAdminDashboardData(); break;
      case 'getAvailableWindowsForUser': _assertConfig_(); data = getAvailableWindowsForUser(_asStr(e.parameter.email)); break;
      case 'getUserProfileByEmail':      _assertConfig_(); data = getUserProfileByEmail(_asStr(e.parameter.email)); break;
      case 'getExamAnalytics':           _assertConfig_(); data = getExamAnalytics(_asStr(e.parameter.examId)); break;
      case 'verifyExamBlueprint':        _assertConfig_(); data = verifyExamBlueprint(_asStr(e.parameter.examId)); break;
      case 'ping': default:              data = { time: new Date().toISOString() };
      case 'testGcsRoundTrip':           _assertConfig_(); data = testGcsRoundTrip(); break;
    }
    return _jsonOK(data);
  } catch (err) {
    return _jsonErr(err);
  }
}

function doPost(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    const data = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    let res;
    switch (action) {
      // Classes
      case 'addClass':     _assertConfig_(); res = classCreate(data); break;
      case 'updateClass':  _assertConfig_(); res = classUpdate(data); break;
      case 'deleteClass':  _assertConfig_(); res = classDelete(data); break;

      // Questions
      case 'addQuestion':     _assertConfig_(); res = questionCreate(data); break;
      case 'updateQuestion':  _assertConfig_(); res = questionUpdate(data); break;
      case 'deleteQuestion':  _assertConfig_(); res = questionDelete(data); break;

      // Exams
      case 'addExam':     _assertConfig_(); res = examCreate(data); break;
      case 'updateExam':  _assertConfig_(); res = examUpdate(data); break;
      case 'deleteExam':  _assertConfig_(); res = examDelete(data); break;

      // Windows
      case 'addWindow':   _assertConfig_(); res = windowCreate(data); break;

      // Snapshots to GCS (N variants)
      case 'syncAndCreateSnapshots':
        _assertConfig_();
        // SỬA LỖI: Truyền examId từ data vào hàm logic. Nếu không có examId, nó sẽ là một chuỗi rỗng và hàm sẽ đồng bộ tất cả.
        res = createSnapshotsAndSyncMetadata(
            _asIntNonNegStrict(data.numVariants, 'numVariants') || 10,
            _asStr(data.examId)
        );
        break;

      // Trả URL snapshot biến thể cho SV
      case 'getExamVariantForStudent':
        _assertConfig_();
        res = getExamVariantForStudent(data);
        break;

      // Dry-run verify (POST)
      case 'verifyExamBlueprint':
        _assertConfig_();
        res = verifyExamBlueprint(_asStr(data.examId));
        break;

      default: throw new Error('Invalid POST action: ' + action);
    }
    return _jsonOK(res);
  } catch (err) {
    return _jsonErr(err);
  }
}


// ======================= NGHIỆP VỤ CHÍNH (DASHBOARD) ==========================
function getAdminDashboardData() {
  const qbank = readQBank();

  const classes = readClasses().map(r => ({
    id: _asStr(r['ID Lớp (để trống)']),
    name: _asStr(r['Tên lớp'])
  }));

  const exams = readExams().map(ex => ({
    id: _asStr(ex['ID Bài thi (để trống)']),
    title: _asStr(ex['Tiêu đề']),
    description: _asStr(ex['Mô tả']),
    duration: _asNum(ex['Thời gian (phút)']),
    pass_threshold: _asNum(ex['Ngưỡng đạt (%)']) / 100,
    totalQuestions: _asNum(ex['Tổng số câu hỏi']),
    blueprint: _asStr(ex['Ma trận đề (JSON)']),
    // mặc định hiển thị biến thể 01 để xem nhanh
    questionsSnapshotUrl: getSnapshotUrlForExam(_asStr(ex['ID Bài thi (để trống)']), 1)
  }));

  // Students (gộp theo email)
  const studentsRaw = readStudents();
  const map = new Map();
  studentsRaw.forEach(s => {
    const email = _asStr(s['Email']);
    if (!email) return;
    if (!map.has(email)) {
      map.set(email, { id: email, name: _asStr(s['Tên học viên']), email, role: 'student', classIds: [] });
    }
    const cls = _asStr(s['ID Lớp']); if (cls) map.get(email).classIds.push(cls);
  });
  const students = Array.from(map.values());

  const windows = readWindows().map(w => ({
    id: _asStr(w['ID Ca thi (để trống)']),
    examId: _asStr(w['ID Bài thi']),
    classId: _asStr(w['ID Lớp']),
    start_at: _asDate(w['Thời gian bắt đầu']).getTime(),
    end_at: _asDate(w['Thời gian kết thúc']).getTime(),
    accessCode: _asStr(w['Mã truy cập']),
  }));

  // Đọc snapshot từ GCS để biết câu hỏi đang dùng ở exam nào (tổng hợp)
  const snaps = readAllSnapshotsFromGCS();
  const usedMap = {};
  snaps.forEach(s => (s.questionIds || []).forEach(qid => {
    if (!usedMap[qid]) usedMap[qid] = [];
    usedMap[qid].push({ examId: s.examId, examTitle: s.examTitle, variant: s.variant });
  }));

  // Chuẩn hoá câu hỏi + answer_key (chỉ cho admin FE)
  const questions = qbank.map(q => {
    const options = q.rawOptions.map((t, i) => ({ id: `opt${i+1}`, text: t }));
    const correct = options.find(o => o.text === q.correctText);
    return {
      id: q.id,
      stem: q.stem,
      options,
      answer_key: correct ? correct.id : null,
      topic: q.topic,
      difficulty: q.difficulty,
      points: q.points,
      imageUrl: q.imageUrl,
      usedInExams: usedMap[q.id] || []
    };
  });

  return { classes, exams, students, windows, questions, qbankCount: qbank.length };
}

function getAvailableWindowsForUser(email) {
  const profile = getUserProfileByEmail(email);
  const exams    = readExams();
  const windows  = readWindows();
  const myWins   = windows.filter(w => profile.classIds.includes(_asStr(w['ID Lớp'])));

  const examMap = {};
  exams.forEach(ex => {
    const id = _asStr(ex['ID Bài thi (để trống)']);
    examMap[id] = {
      id,
      title: _asStr(ex['Tiêu đề']),
      description: _asStr(ex['Mô tả']),
      duration: _asNum(ex['Thời gian (phút)']),
      pass_threshold: _asNum(ex['Ngưỡng đạt (%)']) / 100,
      totalQuestions: _asNum(ex['Tổng số câu hỏi']),
      // default variant 1 để xem nhanh
      questionsSnapshotUrl: getSnapshotUrlForExam(id, 1)
    };
  });

  return myWins.map(w => ({
    id: _asStr(w['ID Ca thi (để trống)']),
    examId: _asStr(w['ID Bài thi']),
    classId: _asStr(w['ID Lớp']),
    start_at: _asDate(w['Thời gian bắt đầu']).getTime(),
    end_at: _asDate(w['Thời gian kết thúc']).getTime(),
    accessCode: _asStr(w['Mã truy cập']),
    exam: examMap[_asStr(w['ID Bài thi'])] || null
  }));
}

function getUserProfileByEmail(email) {
  if (!email) throw new Error('Email is required.');
  const students = readStudents();
  const rows = students.filter(s => _asStr(s['Email']).toLowerCase() === _asStr(email).toLowerCase());
  if (rows.length === 0) throw new Error(`User with email ${email} not found.`);
  const name = _asStr(rows[0]['Tên học viên']);
  const classIds = rows.map(r => _asStr(r['ID Lớp'])).filter(Boolean);
  return { name, email, classIds };
}

function getExamAnalytics(examId) { return { questionAnalytics: [] }; }

// ================================ CRUD ========================================
function classCreate(payload) {
  const name = _asStr(payload.className);
  if (!name) throw new Error('Tên lớp không được để trống.');
  const sh = _ss().getSheetByName(SHEETS.CLASSES);
  const newId = PREFIX.cls + Utilities.getUuid().slice(0, 8).toUpperCase();
  sh.appendRow([newId, name]);
  return { id: newId, name };
}
function classUpdate(payload) {
  const { id, name } = payload.classData || {};
  if (!id) throw new Error('Thiếu ID lớp.');
  const { sh, headers, rows } = _readTable(SHEETS.CLASSES);
  const idCol = headers.indexOf('ID Lớp (để trống)');
  const nameCol = headers.indexOf('Tên lớp');
  const row = rows.find(r => _asStr(r[headers[idCol]]) === id);
  if (!row) throw new Error('Không tìm thấy lớp.');
  if (nameCol >= 0) sh.getRange(row._row, nameCol + 1).setValue(_asStr(name));
  return { id, name };
}
function classDelete(payload) {
  const { classId } = payload;
  if (!classId) throw new Error('Thiếu ID lớp.');
  const { sh, headers, rows } = _readTable(SHEETS.CLASSES);
  const idCol = headers.indexOf('ID Lớp (để trống)');
  const row = rows.find(r => _asStr(r[headers[idCol]]) === classId);
  if (!row) throw new Error('Không tìm thấy lớp.');
  sh.deleteRow(row._row);
  return { id: classId, deleted: true };
}

function questionCreate(payload) {
  const { question: q } = payload;
  const { sh, headers, colMap } = _qbankSheetMeta();
  const newId = PREFIX.q + Utilities.getUuid().slice(0, 8).toUpperCase();

  const newRow = new Array(headers.length).fill('');
  const correctOpt = (q.options || []).find(o => o.id === q.answer_key);

  if (colMap.id) newRow[colMap.id - 1] = newId;
  if (colMap.stem) newRow[colMap.stem - 1] = q.stem || '';
  if (colMap.a && q.options[0]) newRow[colMap.a - 1] = q.options[0].text || '';
  if (colMap.b && q.options[1]) newRow[colMap.b - 1] = q.options[1].text || '';
  if (colMap.c && q.options[2]) newRow[colMap.c - 1] = q.options[2].text || '';
  if (colMap.d && q.options[3]) newRow[colMap.d - 1] = q.options[3].text || '';
  if (colMap.correctText && correctOpt) newRow[colMap.correctText - 1] = correctOpt.text || '';
  if (colMap.topic) newRow[colMap.topic - 1] = q.topic || '';
  if (colMap.difficulty) newRow[colMap.difficulty - 1] = q.difficulty || '';
  if (colMap.points) newRow[colMap.points - 1] = q.points || 1;
  if (colMap.image) newRow[colMap.image - 1] = q.imageUrl || '';

  sh.appendRow(newRow);
  return { ...q, id: newId };
}
function questionUpdate(payload) {
  const { question: q } = payload;
  if (!q || !q.id) throw new Error('Thiếu ID câu hỏi.');
  const { sh, headers, rows } = _readTable(SHEETS.QBANK);

  const idCol = headers.findIndex(h => ['ID Câu hỏi', 'ID'].includes(h));
  const row = rows.find(r => _asStr(r[headers[idCol]]) === q.id);
  if (!row) throw new Error('Không tìm thấy câu hỏi.');

  const col = {};
  Object.keys(QMAP).forEach(k => {
    const i = _findCol(headers, QMAP[k]);
    if (i >= 0) col[k] = i + 1;
  });

  if (col.stem) sh.getRange(row._row, col.stem).setValue(q.stem || '');
  const opt = q.options || [];
  if (col.a) sh.getRange(row._row, col.a).setValue(opt[0]?.text || '');
  if (col.b) sh.getRange(row._row, col.b).setValue(opt[1]?.text || '');
  if (col.c) sh.getRange(row._row, col.c).setValue(opt[2]?.text || '');
  if (col.d) sh.getRange(row._row, col.d).setValue(opt[3]?.text || '');
  if (col.correctText) {
    const hit = opt.find(o => o.id === q.answer_key);
    sh.getRange(row._row, col.correctText).setValue(hit ? hit.text : '');
  }
  if (col.topic) sh.getRange(row._row, col.topic).setValue(q.topic || '');
  if (col.difficulty) sh.getRange(row._row, col.difficulty).setValue(q.difficulty || '');
  if (col.points) sh.getRange(row._row, col.points).setValue(q.points || 1);
  if (col.image) sh.getRange(row._row, col.image).setValue(q.imageUrl || '');

  return { ok: true };
}
function questionDelete(payload) {
  const { questionId } = payload;
  if (!questionId) throw new Error('Thiếu ID câu hỏi.');
  const { sh, headers, rows } = _readTable(SHEETS.QBANK);
  const idCol = headers.findIndex(h => ['ID Câu hỏi', 'ID'].includes(h));
  const row = rows.find(r => _asStr(r[headers[idCol]]) === questionId);
  if (!row) throw new Error('Không tìm thấy câu hỏi.');
  sh.deleteRow(row._row);
  return { id: questionId, deleted: true };
}

function examCreate(payload) {
  const { exam } = payload;
  const sh = _ss().getSheetByName(SHEETS.EXAMS);
  const newId = PREFIX.ex + Utilities.getUuid().slice(0, 8).toUpperCase();
  sh.appendRow([
    newId,
    _asStr(exam.title || ''),
    _asStr(exam.description || ''),
    _asNum(exam.duration || 0),
    Math.round((_asNum(exam.pass_threshold || 0) * 100)),
    _asNum(exam.totalQuestions || 0),
    typeof exam.blueprint === 'string' ? exam.blueprint : JSON.stringify(exam.blueprint || [])
  ]);
  return { ...exam, id: newId };
}
function examUpdate(payload) {
  const { exam } = payload;
  const { sh, rows, headers } = _readTable(SHEETS.EXAMS);
  const idCol = headers.indexOf('ID Bài thi (để trống)');
  const row = rows.find(r => _asStr(r[headers[idCol]]) === exam.id);
  if (!row) throw new Error('Không tìm thấy bài thi.');

  const set = (name, val) => { const c = headers.indexOf(name); if (c >= 0) sh.getRange(row._row, c + 1).setValue(val); };
  set('Tiêu đề', exam.title || '');
  set('Mô tả', exam.description || '');
  set('Thời gian (phút)', _asNum(exam.duration || 0));
  set('Ngưỡng đạt (%)', Math.round((_asNum(exam.pass_threshold || 0) * 100)));
  set('Tổng số câu hỏi', _asNum(exam.totalQuestions || 0));
  set('Ma trận đề (JSON)', typeof exam.blueprint === 'string' ? exam.blueprint : JSON.stringify(exam.blueprint || []));
  return exam;
}
function examDelete(payload) {
  const { examId } = payload;
  const { sh, rows, headers } = _readTable(SHEETS.EXAMS);
  const idCol = headers.indexOf('ID Bài thi (để trống)');
  const row = rows.find(r => _asStr(r[headers[idCol]]) === examId);
  if (!row) throw new Error('Không tìm thấy bài thi.');
  sh.deleteRow(row._row);
  return { id: examId, deleted: true };
}

function windowCreate(payload) {
  const { windowData } = payload;
  const sh = _ss().getSheetByName(SHEETS.WINDOWS);
  const newId = PREFIX.win + Utilities.getUuid().slice(0, 8).toUpperCase();
  sh.appendRow([
    newId,
    _asStr(windowData.examId),
    _asStr(windowData.classId),
    new Date(windowData.start_at),
    new Date(windowData.end_at),
    _asStr(windowData.accessCode)
  ]);
  return { ...windowData, id: newId };
}

// =========================== RNG & SHUFFLE HELPERS ============================
function _seedFrom(examId, variant) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, examId + '#' + variant);
  let s = 0; for (let i = 0; i < 4; i++) s = (s << 8) | (b[i] & 0xff);
  return (s >>> 0) || 0xA5F1D3C9;
}
function _mulberry32(a){ return function(){ a|=0; a = (a + 0x6D2B79F5)|0; var t = Math.imul(a ^ (a>>>15), 1|a); t ^= t + Math.imul(t ^ (t>>>7), 61|t); return ((t ^ (t>>>14)) >>> 0) / 4294967296; }; }
function _shuffleInPlace(arr, rnd){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=arr[i]; arr[i]=arr[j]; arr[j]=t; } return arr; }
function _shuffleOptionsAndFixKey(rawOptions, correctIndex, rnd){
  const base = rawOptions.map((text, idx) => ({ text, idx }));
  _shuffleInPlace(base, rnd);
  const opts = base.map((b, i) => ({ id: `opt${i+1}`, text: b.text, _orig: b.idx }));
  const pos = opts.findIndex(o => o._orig === correctIndex);
  const correctId = (pos >= 0) ? `opt${pos+1}` : null;
  return { options: opts.map(({id,text}) => ({id,text})), correctId };
}

// ====================== ĐỘ KHÓ TÍCH LŨY (LADDER & ALLOCATOR) ==================
function difficultyLadder(){
  try{
    const arr = JSON.parse(CONFIG.DIFFICULTY_LADDER || '[]');
    if (Array.isArray(arr) && arr.length) return arr.map(x => String(x));
  }catch(e){}
  return ["Dễ","Trung bình","Khó"];
}
function parseDifficultyRank(v){
  // Trả rank: 1 = dễ nhất. Nếu không nhận diện được → Infinity (bỏ qua).
  if (v == null) return Infinity;
  const s = String(v).trim();
  if (/^\d+$/.test(s)) {
    const n = parseInt(s,10);
    return (n >= 1) ? n : Infinity;
  }
  const ladder = difficultyLadder().map(x => x.toLowerCase());
  const idx = ladder.indexOf(s.toLowerCase());
  return (idx >= 0) ? (idx+1) : Infinity;
}

function allocateFromLadder(poolByRank, requestedRank, need, capShare, rnd, usedIds){
  // poolByRank: Map<number, Question[]>, đã lọc theo topic và loại bỏ usedIds trước khi truyền vào
  // Trả: { picked: Question[], breakdown: {rank:count,...}, missing: number }
  const picked = [];
  const breakdown = {};
  const ranks = []; // yêu cầu bậc D, fallback D-1, D-2, ...
  for (let r = requestedRank; r >= 1; r--) ranks.push(r);

  const capCount = (capShare > 0 && capShare < 1) ? Math.floor(need * capShare + 1e-9) : need;
  let takenFromFallback = 0;

  for (let i = 0; i < ranks.length && picked.length < need; i++){
    const r = ranks[i];
    const pool = (poolByRank.get(r) || []).filter(q => !usedIds.has(q.id));
    if (!pool.length) continue;

    // Xáo pool để lấy ngẫu nhiên ổn định theo seed
    const arr = pool.slice();
    _shuffleInPlace(arr, rnd);

    // Nếu là bậc thấp hơn requested → áp trần fallback
    const isFallback = (r !== requestedRank);
    let canTake = Math.min(arr.length, need - picked.length);
    if (isFallback && capShare > 0 && capShare < 1) {
      const remainFallbackCap = Math.max(0, capCount - takenFromFallback);
      canTake = Math.min(canTake, remainFallbackCap);
    }
    if (canTake <= 0) continue;

    const seg = arr.slice(0, canTake);
    seg.forEach(q => usedIds.add(q.id));
    picked.push(...seg);
    breakdown[r] = (breakdown[r] || 0) + seg.length;
    if (isFallback) takenFromFallback += seg.length;
  }

  const missing = Math.max(0, need - picked.length);
  return { picked, breakdown, missing };
}

// =============== TẠO SNAPSHOT (CÓ FALLBACK + XÁO CÂU & PHƯƠNG ÁN) =============
function createExamSnapshot(examRow, qbank, includeAnswerKeyOnQuestion, rng) {
  const examId   = _asStr(examRow['ID Bài thi (để trống)']);
  const title    = _asStr(examRow['Tiêu đề']);
  const duration = _asNum(examRow['Thời gian (phút)']);
  const pass     = _asNum(examRow['Ngưỡng đạt (%)']) / 100;
  
  // --- LOGGING START ---
  const totalRaw = examRow['Tổng số câu hỏi'];
  Logger.log(`[DEBUG ${examId}] Raw 'Tổng số câu hỏi': ${totalRaw} (Type: ${typeof totalRaw})`);
  const total    = _asIntNonNegStrict(totalRaw); // Đã sửa: bỏ tham số không cần thiết
  Logger.log(`[DEBUG ${examId}] Parsed 'total': ${total}`);
  // --- LOGGING END ---
  
  const blueprintJson = _asStr(examRow['Ma trận đề (JSON)']);

  let rules = [];
  try { rules = JSON.parse(blueprintJson || '[]'); }
  catch(e){ throw new Error(`Exam[${examId}] Ma trận đề JSON không hợp lệ: ${e}`); }
  if (!Array.isArray(rules)) throw new Error(`Exam[${examId}] Ma trận đề phải là mảng.`);

  const rnd = rng || Math.random;
  const usedIds = new Set();
  const enableFallback = !!CONFIG.ENABLE_DIFFICULTY_FALLBACK;
  const capShare = Number(CONFIG.FALLBACK_MAX_SHARE_PER_RULE) || 1.0;

  const bank = new Map();
  qbank.forEach(q => {
    const topic = _asStr(q.topic);
    const rank  = parseDifficultyRank(q.difficulty);
    if (!isFinite(rank)) return;
    if (!bank.has(topic)) bank.set(topic, new Map());
    const m = bank.get(topic);
    if (!m.has(rank)) m.set(rank, []);
    m.get(rank).push(q);
  });

  const picked = [];
  const answerKey = {};
  const diagnostics = [];

  rules.forEach((rule, idx) => {
    const topic = _asStr(rule.topic);
    const need  = _asIntNonNegStrict(rule.count, `blueprint[${idx}].count`);
    const reqRank = parseDifficultyRank(rule.difficulty);
    if (!bank.has(topic)) {
      diagnostics.push({
        ruleIndex: idx, topic, requestedDifficulty: rule.difficulty, requestedCount: need,
        taken: {}, missing: need, note: `Không có câu hỏi topic="${topic}".`
      });
      return;
    }

    const poolByRank = new Map();
    const m = bank.get(topic);
    m.forEach((arr, r) => {
      const filtered = arr.filter(q => !usedIds.has(q.id));
      if (filtered.length) poolByRank.set(r, filtered);
    });

    let result;
    if (enableFallback && isFinite(reqRank)) {
      result = allocateFromLadder(poolByRank, reqRank, need, capShare, rnd, usedIds);
    } else {
      const pool = (poolByRank.get(reqRank) || []).filter(q => !usedIds.has(q.id));
      const arr = pool.slice();
      _shuffleInPlace(arr, rnd);
      const seg = arr.slice(0, Math.min(need, arr.length));
      seg.forEach(q => usedIds.add(q.id));
      const breakdown = {}; breakdown[reqRank] = seg.length;
      result = { picked: seg, breakdown, missing: Math.max(0, need - seg.length) };
    }

    result.picked.forEach(q => {
      const raw = q.rawOptions.slice(0, 4);
      const correctIndex = raw.findIndex(t => t === q.correctText);
      const sh = _shuffleOptionsAndFixKey(raw, correctIndex, rnd);

      const qObj = {
        id: q.id,
        stem: q.stem,
        options: sh.options,
        points: q.points,
        topic: q.topic,
        difficulty: q.difficulty,
        imageUrl: q.imageUrl
      };
      if (includeAnswerKeyOnQuestion && sh.correctId) qObj.answer_key = sh.correctId;
      picked.push(qObj);
      if (sh.correctId) answerKey[q.id] = sh.correctId;
    });

    diagnostics.push({
      ruleIndex: idx,
      topic,
      requestedDifficulty: rule.difficulty,
      requestedCount: need,
      taken: result.breakdown, // {rank: count}
      missing: result.missing
    });
  });

  // Xáo thứ tự câu hỏi toàn bài để thêm đa dạng
  _shuffleInPlace(picked, rnd);

  if (total > 0 && picked.length > total) picked.length = total;

  const snapshot = {
    examId, title,
    duration,
    pass_threshold: pass,
    totalQuestions: picked.length,
    questions: picked
  };

  const summaryMissing = diagnostics.reduce((s, d) => s + (d.missing || 0), 0);
  if (summaryMissing > 0) {
    // Không throw ở đây — để verify có thể xem chẩn đoán; nhưng khi “đồng bộ” cần throw.
  }
  return { snapshot, answerKey, diagnostics, ladder: difficultyLadder() };
}

// Thay thế toàn bộ hàm cũ bằng hàm này
function createSnapshotsAndSyncMetadata(numVariants, examIdToSync) {
  const qbank = readQBank();
  const allExams = readExams();

  const examsToProcess = examIdToSync
    ? allExams.filter(ex => _asStr(ex['ID Bài thi (để trống)']) === examIdToSync)
    : allExams;

  if (examIdToSync && examsToProcess.length === 0) {
      throw new Error(`Không tìm thấy bài thi với ID: ${examIdToSync}`);
  }

  const N = _asIntNonNegStrict(numVariants, 'numVariants') || 10;
  const successes = [];
  const failures  = [];

  examsToProcess.forEach(ex => {
    const examId    = _asStr(ex['ID Bài thi (để trống)']);
    const examTitle = _asStr(ex['Tiêu đề']);
    if (!examId) return;

    for (let v = 1; v <= N; v++) {
      try {
        const rng = _mulberry32(_seedFrom(examId, v));
        const { snapshot, answerKey, diagnostics } = createExamSnapshot(ex, qbank, /*includeAnswerKeyOnQuestion=*/false, rng);

        const missing = (diagnostics || []).reduce((s, d) => s + (d.missing || 0), 0);
        if (missing > 0) {
          throw new Error(`Exam ${examId} (variant ${v}) thiếu tổng ${missing} câu theo blueprint. Xem diagnostics để biết chi tiết.`);
        }

        const info = saveVariantToGCS(examId, v, snapshot, answerKey);
        successes.push({
          examId, examTitle, variant: v,
          snapshotUrl: info.snapshotUrl,
          totalQuestions: snapshot.questions.length,
          diagnostics
        });
      } catch (e) {
        // === NÂNG CẤP XỬ LÝ LỖI ĐỂ LẤY STACK TRACE ===
        const stack = e.stack ? String(e.stack).split('\n').slice(0, 4).join('\n') : 'No stack available';
        const errorMessage = `Error: "${e.message}" at ${stack}`;
        failures.push({ examId, examTitle, variant: v, error: errorMessage });
        // ============================================
      }
    }
  });

  return { successes, failures };
}

function saveVariantToGCS(examId, variant, snapshotObj, answerKeyObj) {
  const suf = `_variant-${(''+variant).padStart(2,'0')}`;
  const snapName = `${examId}${suf}_snapshot.json`;
  const keyName  = `${examId}${suf}_answer_key.json`;

  // Upload snapshot (PUBLIC bucket)
  gcsUploadJson_(CONFIG.GCS_PUBLIC_BUCKET, snapName, JSON.stringify(snapshotObj, null, 2));

  // Upload answer key (PRIVATE nếu có, ngược lại PUBLIC – không khuyến nghị)
  const keyBucket = CONFIG.GCS_PRIVATE_BUCKET || CONFIG.GCS_PUBLIC_BUCKET;
  gcsUploadJson_(keyBucket, keyName, JSON.stringify(answerKeyObj, null, 2));

  const snapshotUrl = `https://storage.googleapis.com/${encodeURIComponent(CONFIG.GCS_PUBLIC_BUCKET)}/${encodeURIComponent(snapName)}`;
  return { snapshotUrl };
}
// =========================== GCS HELPERS (JWT SA) =============================
// ... [Các hàm gcsUploadJson_, gcsListAll_, gcsGetObjectText_ của bạn] ...

function gcsDeleteObject_(bucket, objectName) {
  const token = _gcsAccessToken_();
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}`;
  const res = UrlFetchApp.fetch(url, {
    method: 'delete',
    headers: { 'Authorization': `Bearer ${token}` },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  // 204 No Content là mã thành công cho việc xóa
  if (code !== 204 && (code < 200 || code >= 300)) {
    throw new Error(`GCS delete failed (${code}): ${res.getContentText()}`);
  }
  return { ok: true };
}
// ========================== TEST GCS ROUNDTRIP ==============================
/**
 * Thực hiện test round-trip (Write/Read/List/Delete) với GCS.
 * Kiểm tra cả Public Bucket và Private Bucket (nếu được cấu hình).
 */
function testGcsRoundTrip() {
  _assertConfig_(); // Đảm bảo config đã được load
  const results = {};
  const filesToDelete = []; // Luôn dọn dẹp dù test thất bại

  /**
   * Hàm con để chạy test cho một bucket cụ thể.
   */
  const runTestForBucket = (bucketName, bucketConfigKey) => {
    if (!bucketName) {
      Logger.log('Skipping test for %s (not configured)', bucketConfigKey);
      return { status: 'SKIPPED', message: `${bucketConfigKey} is not configured.` };
    }

    const testFile = `_test/gas_gcs_test_${Date.now()}.json`;
    filesToDelete.push({ bucket: bucketName, file: testFile }); // Thêm vào danh sách dọn dẹp
    const testData = { status: 'ok', timestamp: new Date().toISOString(), bucket: bucketName };
    const testContent = JSON.stringify(testData);
    const steps = {};

    try {
      Logger.log('--- Testing Bucket: %s (%s) ---', bucketName, bucketConfigKey);
      
      // 2. Write
      gcsUploadJson_(bucketName, testFile, testContent);
      steps.write = `OK (${testFile})`;
      Logger.log('  2. Write: OK (%s)', testFile);

      // 3. Read
      const readContent = gcsGetObjectText_(bucketName, testFile);
      const readData = JSON.parse(readContent);
      if (readData.timestamp !== testData.timestamp) throw new Error('Read data mismatch.');
      steps.read = 'OK (content matched)';
      Logger.log('  3. Read: OK (content matched)');

      // 4. List
      // List chính xác file đó để kiểm tra
      const list = gcsListAll_(bucketName, testFile);
      if (!list || list.length === 0 || list[0].name !== testFile) throw new Error('List failed to find exact file.');
      steps.list = 'OK (found file)';
      Logger.log('  4. List: OK (found file)');
      
      Logger.log('--- Test PASSED for %s ---', bucketName);
      return { status: 'SUCCESS', file: testFile, steps };

    } catch (e) {
      Logger.log('--- Test FAILED for %s: %s ---', bucketName, e.message);
      return { status: 'FAILED', error: e.message, steps };
    }
  };

  // --- BẮT ĐẦU TEST ---
  try {
    // 1. Get Token (Thất bại nhanh nếu sai credentials)
    Logger.log('--- Initializing GCS Test ---');
    const token = _gcsAccessToken_();
    if (!token) throw new Error("Failed to get Access Token (check SA credentials).");
    Logger.log('  1. Get Token: OK (length %s)', token.length);
    results.tokenCheck = { status: 'SUCCESS' };

    // Test các buckets
    results.publicBucket = runTestForBucket(CONFIG.GCS_PUBLIC_BUCKET, 'GCS_PUBLIC_BUCKET');
    results.privateBucket = runTestForBucket(CONFIG.GCS_PRIVATE_BUCKET, 'GCS_PRIVATE_BUCKET');
  
  } catch (e) {
    // Lỗi nghiêm trọng (ví dụ: lấy token thất bại)
    Logger.log('--- GLOBAL TEST FAILURE: %s ---', e.message);
    results.globalError = e.message;
    results.tokenCheck = results.tokenCheck || { status: 'FAILED', error: e.message };
  } finally {
    // 5. Cleanup
    Logger.log('--- Cleanup ---');
    results.cleanup = [];
    filesToDelete.forEach(item => {
      try {
        gcsDeleteObject_(item.bucket, item.file);
        Logger.log('  Deleted: %s/%s', item.bucket, item.file);
        results.cleanup.push({ status: 'SUCCESS', file: item.file, bucket: item.bucket });
      } catch (e) {
        Logger.log('  Cleanup FAILED for %s/%s: %s', item.bucket, item.file, e.message);
        results.cleanup.push({ status: 'FAILED', file: item.file, bucket: item.bucket, error: e.message });
      }
    });
    Logger.log('--- Test Complete ---');
  }
  
  // Tính toán trạng thái tổng thể
  const isSuccess = (
    results.tokenCheck?.status === 'SUCCESS' &&
    results.publicBucket?.status === 'SUCCESS' &&
    (results.privateBucket?.status === 'SUCCESS' || results.privateBucket?.status === 'SKIPPED')
  );
  const overallStatus = isSuccess ? 'SUCCESS' : 'FAILED';
                  
  return { overallStatus, details: results };
}

// ... [Hàm _gcsAccessToken_ của bạn] ...
// =========================== GCS HELPERS (JWT SA) =============================
function gcsUploadJson_(bucket, objectName, jsonString) {
  const token = _gcsAccessToken_();
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    payload: jsonString,
    headers: { 'Authorization': `Bearer ${token}` },
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`GCS upload failed (${code}): ${res.getContentText()}`);
  return JSON.parse(res.getContentText());
}

function gcsListAll_(bucket, prefix) {
  const token = _gcsAccessToken_();
  let url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(prefix || '')}`;
  const items = [];
  while (true) {
    const res = UrlFetchApp.fetch(url, { method: 'get', headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code < 200 || code >= 300) throw new Error(`GCS list failed (${code}): ${res.getContentText()}`);
    const json = JSON.parse(res.getContentText());
    (json.items || []).forEach(it => items.push(it));
    if (json.nextPageToken) {
      url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(prefix || '')}&pageToken=${encodeURIComponent(json.nextPageToken)}`;
    } else break;
  }
  return items;
}

function gcsGetObjectText_(bucket, objectName) {
  const token = _gcsAccessToken_();
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  const res = UrlFetchApp.fetch(url, { method: 'get', headers: { 'Authorization': `Bearer ${token}` }, muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`GCS get object failed (${code}): ${res.getContentText()}`);
  return res.getContentText();
}

// Lấy access token bằng JWT SA, cache ~55 phút
function _gcsAccessToken_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('gcs_access_token');
  if (cached) return cached;

  const email = CONFIG.SA_EMAIL;
  const key = CONFIG.SA_PRIVATE_KEY;
  if (!email || !key) throw new Error('Chưa cấu hình GCS.SA_EMAIL / GCS.PRIVATE_KEY.');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const enc = (o) => Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/,'');
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const signatureBytes = Utilities.computeRsaSha256Signature(unsigned, key);
  const jwt = `${unsigned}.${Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/,'')}`;

  const resp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions: true
  });
  const code = resp.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`Token exchange failed (${code}): ${resp.getContentText()}`);

  const json = JSON.parse(resp.getContentText());
  const token = json.access_token;
  const ttl = Math.max(60, Math.min(3300, (json.expires_in || 3600) - 300));
  cache.put('gcs_access_token', token, Math.floor(ttl));
  return token;
}

// ============== ĐỌC SNAPSHOTS TỪ GCS (cho Dashboard “usedInExams”) ============
function getSnapshotUrlForExam(examId, variant) {
  if (!examId || !CONFIG.GCS_PUBLIC_BUCKET) return '';
  const suf = `_variant-${(''+(variant||1)).padStart(2,'0')}`;
  return `https://storage.googleapis.com/${encodeURIComponent(CONFIG.GCS_PUBLIC_BUCKET)}/${encodeURIComponent(examId + suf + '_snapshot.json')}`;
}

function readAllSnapshotsFromGCS() {
  if (!CONFIG.GCS_PUBLIC_BUCKET) return [];
  const items = gcsListAll_(CONFIG.GCS_PUBLIC_BUCKET, '');
  const list = [];
  items.forEach(it => {
    if (!it || !it.name || !it.name.endsWith('_snapshot.json')) return;
    // Tên dạng: EXAMID_variant-XX_snapshot.json
    const m = it.name.match(/^(.*)_variant-(\d{2})_snapshot\.json$/);
    try {
      const txt = gcsGetObjectText_(CONFIG.GCS_PUBLIC_BUCKET, it.name);
      const data = JSON.parse(txt);
      list.push({
        examId: data.examId || (m ? m[1] : ''),
        examTitle: data.title,
        variant: m ? parseInt(m[2],10) : null,
        questionIds: (data.questions || []).map(q => q.id)
      });
    } catch (e) {
      console.error(`Failed to parse snapshot ${it.name}: ${e.message}`);
    }
  });
  return list;
}

// ============================ HELPERS & READERS ================================
function _ss() { return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID); }

// _asStr an toàn: dọn NBSP/zero-width/control chars, không sập nếu thiếu normalize
function _asStr(v) {
  if (v == null) return '';
  var s = '' + v;
  try { if (typeof s.normalize === 'function') s = s.normalize('NFKC'); } catch (e) {}
  s = s.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  s = s.replace(/[\u200B\u200C\u200D\uFEFF\u2060\u00AD]/g, '');
  s = s.replace(/[\u0000-\u001F\u007F]/g, '');
  s = s.replace(/[ \t\f\v\r\n]+/g, ' ').trim();
  return s;
}
function _asNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function _asIntNonNegStrict(v) { const n = parseInt(v,10); return (isNaN(n) || n < 0) ? 0 : n; }
function _asDate(v) { return v instanceof Date ? v : new Date(v); }

function _readTable(sheetName) {
  const sh = _ss().getSheetByName(sheetName);
  if (!sh) return { sh: null, headers: [], rows: [] };
  const data = sh.getDataRange().getValues();
  if (data.length === 0) return { sh, headers: [], rows: [] };
  const headers = (data.shift() || []).map(h => _asStr(h));
  const rows = data.map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, j) => obj[h] = (typeof row[j] === 'string') ? _asStr(row[j]) : row[j]);
    return obj;
  });
  return { sh, headers, rows };
}
function _findCol(headers, possibleNames) { return headers.findIndex(h => possibleNames.includes(h)); }
function _qbankSheetMeta() {
  const { sh, headers } = _readTable(SHEETS.QBANK);
  const colMap = {};
  Object.keys(QMAP).forEach(k => { const idx = _findCol(headers, QMAP[k]); if (idx >= 0) colMap[k] = idx + 1; });
  return { sh, headers, colMap };
}

function readQBank() {
  const { headers, rows } = _readTable(SHEETS.QBANK);
  const c = {};
  Object.keys(QMAP).forEach(k => { c[k] = _findCol(headers, QMAP[k]); });
  if (c.id < 0 || c.stem < 0) return [];
  return rows.map(r => {
    const id = _asStr(r[headers[c.id]]);
    if (!id) return null;
    const rawOpts = [c.a, c.b, c.c, c.d].map(i => i >= 0 ? _asStr(r[headers[i]]) : '').filter(Boolean);
    return {
      id,
      stem: _asStr(r[headers[c.stem]]),
      rawOptions: rawOpts,
      correctText: c.correctText >= 0 ? _asStr(r[headers[c.correctText]]) : '',
      points: c.points >= 0 ? _asNum(r[headers[c.points]]) : 1,
      topic: c.topic >= 0 ? _asStr(r[headers[c.topic]]) : '',
      difficulty: c.difficulty >= 0 ? _asStr(r[headers[c.difficulty]]) : '',
      imageUrl: c.image >= 0 ? _asStr(r[headers[c.image]]) : '',
    };
  }).filter(Boolean);
}

function readClasses()  { return _readTable(SHEETS.CLASSES).rows; }
function readExams()    { return _readTable(SHEETS.EXAMS).rows; }
function readStudents() { return _readTable(SHEETS.STUDENTS).rows; }
function readWindows()  { return _readTable(SHEETS.WINDOWS).rows; }

// =========================== API SV: CHỈ ĐỊNH BIẾN THỂ ========================
function getExamVariantForStudent(payload){
  const examId = _asStr(payload.examId);
  const email  = _asStr(payload.studentEmail || payload.email);
  if (!examId) throw new Error('Thiếu examId.');
  if (!email)  throw new Error('Thiếu studentEmail.');

  const N = _asIntNonNegStrict(payload.numVariants) || 10;
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, examId + '|' + email);
  let h = 0; for (let i = 0; i < 4; i++) h = (h << 8) | (bytes[i] & 0xff);
  const variant = (h >>> 0) % N + 1;

  const url = getSnapshotUrlForExam(examId, variant);
  return { examId, variant, url };
}

// ============================= VERIFY BLUEPRINT (DRY) =========================
function verifyExamBlueprint(examId){
  if (!examId) throw new Error('Thiếu examId.');
  const qbank = readQBank();
  const exRow = readExams().find(r => _asStr(r['ID Bài thi (để trống)']) === examId);
  if (!exRow) throw new Error(`Không tìm thấy bài thi: ${examId}`);

  // chạy 1 lần (seed bất kỳ) → chỉ để chẩn đoán
  const rng = _mulberry32(_seedFrom(examId, 999));
  const { diagnostics, ladder } = createExamSnapshot(exRow, qbank, false, rng);
  const totalMissing = diagnostics.reduce((s, d) => s + (d.missing || 0), 0);

  return {
    examId,
    ladder,
    diagnostics, // mỗi rule: {requestedDifficulty, requestedCount, taken:{rank:count}, missing}
    ok: totalMissing === 0,
    totalMissing
  };
}