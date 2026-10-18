import "server-only";
import ExcelJS from "exceljs";
import { db } from "./db";
import { GENDERS, RATINGS, STUDENT_STATUS } from "./constants";
import { classify, formatResult, overallAverage, subjectResult, type SubjectResult } from "./grades";
import { getPeriod, type Period } from "./period";
import { fmtDate, vnNameCompare } from "./utils";
import { cellText } from "./excel";

type Value = string | number | null;
export type ReportData = { header: Record<string, Value>; rows: Record<string, Value>[]; period: Period };

/** Danh sách token để hiển thị hướng dẫn cho trường tự thiết kế mẫu. */
export const HEADER_TOKENS: [string, string][] = [
  ["so", "Cơ quan chủ quản (Sở / Phòng GD&ĐT)"],
  ["truong", "Tên trường"],
  ["diachi_truong", "Địa chỉ trường"],
  ["hieutruong", "Hiệu trưởng"],
  ["lop", "Tên lớp"],
  ["khoi", "Khối"],
  ["namhoc", "Năm học"],
  ["gvcn", "Giáo viên chủ nhiệm"],
  ["ky", "Kỳ báo cáo (Học kỳ I / Học kỳ II / Cả năm / Tháng…)"],
  ["siso", "Sĩ số"],
  ["nam", "Số học sinh nam"],
  ["nu", "Số học sinh nữ"],
  ["ngay", "Ngày xuất (dd/mm/yyyy)"],
  ["ngay_ky", "Dòng ngày ký: \"<địa danh>, ngày … tháng … năm …\""],
  ["matkhau", "Mật khẩu mặc định của trường"],
];

export const ROW_TOKENS: [string, string][] = [
  ["stt", "Số thứ tự"],
  ["ma", "Mã học sinh"],
  ["hoten", "Họ và tên"],
  ["ngaysinh", "Ngày sinh"],
  ["gioitinh", "Giới tính"],
  ["dantoc", "Dân tộc"],
  ["diachi", "Địa chỉ"],
  ["phuhuynh", "Họ tên phụ huynh"],
  ["quanhe", "Quan hệ"],
  ["sdt_ph", "SĐT phụ huynh"],
  ["tk_hs", "Tên đăng nhập học sinh"],
  ["tk_ph", "Tên đăng nhập phụ huynh"],
  ["vang_p", "Số buổi vắng có phép (trong kỳ)"],
  ["vang_kp", "Số buổi vắng không phép"],
  ["vang", "Tổng số buổi vắng"],
  ["muon", "Số lần đi muộn"],
  ["khen", "Số lần khen thưởng"],
  ["vipham", "Số lần vi phạm"],
  ["diem_MAMON", "ĐTB môn trong kỳ (Đ/CĐ với môn nhận xét), vd {{diem_TOAN}}"],
  ["tbcm", "Trung bình các môn tính điểm (tham khảo)"],
  ["hoctap", "Kết quả học tập (Tốt/Khá/Đạt/Chưa đạt)"],
  ["renluyen", "Kết quả rèn luyện"],
  ["nhanxet", "Nhận xét của GVCN"],
  ["trangthai", "Tình trạng (Đang học / Chuyển trường…)"],
];

const ROW_KEYS = new Set(ROW_TOKENS.map(([k]) => k));
const isRowToken = (k: string) => ROW_KEYS.has(k) || k.startsWith("diem_");
const TOKEN_RE = /\{\{\s*([\w]+)\s*\}\}/g;

export async function buildReportData(classId: string, periodKey: string | undefined): Promise<ReportData> {
  const cls = await db.class.findUniqueOrThrow({
    where: { id: classId },
    include: { school: true, academicYear: true, homeroomTeacher: { select: { name: true } } },
  });
  const period = getPeriod(cls.academicYear, periodKey);
  const range = { gte: period.from, lt: period.to };
  const evalSemester = period.semester === 0 ? 2 : period.semester;

  const [students, subjects, att, conduct, grades] = await Promise.all([
    db.student.findMany({
      where: { classId, status: "ACTIVE" },
      include: {
        user: { select: { username: true } },
        parentUser: { select: { username: true } },
        evaluations: { where: { academicYearId: cls.academicYearId, semester: evalSemester } },
      },
    }),
    db.subject.findMany({ where: { schoolId: cls.schoolId, active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.attendance.groupBy({ by: ["studentId", "status"], where: { classId, date: range }, _count: true }),
    db.conductRecord.groupBy({ by: ["studentId", "type"], where: { student: { classId }, date: range }, _count: true }),
    db.grade.findMany({ where: { student: { classId }, academicYearId: cls.academicYearId } }),
  ]);
  students.sort((a, b) => vnNameCompare(a.fullName, b.fullName));

  const semesters = period.semester === 0 ? [1, 2] : [period.semester];
  const usedSubjects = subjects.filter((s) => grades.some((g) => g.subjectId === s.id && semesters.includes(g.semester)));
  const attCount = (sid: string, st: string) => att.find((a) => a.studentId === sid && a.status === st)?._count ?? 0;
  const condCount = (sid: string, t: string) => conduct.find((c) => c.studentId === sid && c.type === t)?._count ?? 0;

  const rows = students.map((s, i) => {
    const results = new Map<string, SubjectResult>();
    for (const sub of subjects) {
      results.set(sub.id, subjectResult(sub.type, grades.filter((g) => g.studentId === s.id && g.subjectId === sub.id), period.semester));
    }
    const used = usedSubjects.map((sub) => results.get(sub.id)!);
    const hoctap = classify(used);
    const ev = s.evaluations[0];
    const vp = attCount(s.id, "EXCUSED");
    const vkp = attCount(s.id, "UNEXCUSED");
    const row: Record<string, Value> = {
      stt: i + 1,
      ma: s.code,
      hoten: s.fullName,
      ngaysinh: fmtDate(s.dob),
      gioitinh: s.gender ? GENDERS[s.gender as keyof typeof GENDERS] : "",
      dantoc: s.ethnicity,
      diachi: s.address,
      phuhuynh: s.parentName,
      quanhe: s.parentRelation,
      sdt_ph: s.parentPhone,
      tk_hs: s.user?.username ?? "",
      tk_ph: s.parentUser?.username ?? "",
      vang_p: vp,
      vang_kp: vkp,
      vang: vp + vkp,
      muon: attCount(s.id, "LATE"),
      khen: condCount(s.id, "PRAISE"),
      vipham: condCount(s.id, "VIOLATION"),
      tbcm: overallAverage(used),
      hoctap: hoctap ? RATINGS[hoctap] : "",
      renluyen: ev ? RATINGS[ev.rating as keyof typeof RATINGS] : "",
      nhanxet: ev?.comment ?? "",
      trangthai: STUDENT_STATUS[s.status as keyof typeof STUDENT_STATUS],
    };
    for (const sub of subjects) {
      const r = results.get(sub.id)!;
      row[`diem_${sub.code}`] = r.type === "SCORE" && r.value != null ? r.value : formatResult(r);
    }
    return row;
  });

  const now = new Date();
  const vnNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const header: Record<string, Value> = {
    so: cls.school.authority ?? "",
    truong: cls.school.name.toUpperCase(),
    diachi_truong: cls.school.address ?? "",
    hieutruong: cls.school.principal ?? "",
    lop: cls.name,
    khoi: cls.grade,
    namhoc: cls.academicYear.name,
    gvcn: cls.homeroomTeacher?.name ?? "",
    ky: period.label,
    siso: students.length,
    nam: students.filter((s) => s.gender === "NAM").length,
    nu: students.filter((s) => s.gender === "NU").length,
    ngay: `${String(vnNow.getDate()).padStart(2, "0")}/${String(vnNow.getMonth() + 1).padStart(2, "0")}/${vnNow.getFullYear()}`,
    ngay_ky: `${cls.school.location ? cls.school.location + ", " : ""}ngày ${vnNow.getDate()} tháng ${vnNow.getMonth() + 1} năm ${vnNow.getFullYear()}`,
    matkhau: cls.school.defaultPassword,
  };
  return { header, rows, period };
}

/** Thay token trong một ô. Ô chỉ chứa đúng 1 token số → ghi dạng số để Excel tính toán được. */
function fillCell(cell: ExcelJS.Cell, data: Record<string, Value>) {
  if (cell.type === ExcelJS.ValueType.Formula) return;
  const text = cellText(cell.value);
  if (!text.includes("{{")) return;
  const single = text.match(/^\{\{\s*(\w+)\s*\}\}$/);
  if (single) {
    const v = data[single[1]];
    if (v !== undefined) cell.value = v === null || v === "" ? null : v;
    return;
  }
  cell.value = text.replace(TOKEN_RE, (m, k) => (data[k] !== undefined ? String(data[k] ?? "") : m));
}

/**
 * Điền dữ liệu vào mẫu Excel:
 *  - Dòng đầu tiên chứa token theo học sinh ({{hoten}}, {{diem_TOAN}}…) được nhân bản cho mỗi học sinh
 *    (giữ nguyên định dạng, viền, độ rộng).
 *  - Các ô còn lại được thay token chung ({{truong}}, {{lop}}…).
 */
export async function fillTemplate(template: Buffer | ArrayBuffer, data: ReportData) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template as ArrayBuffer);
  for (const ws of wb.worksheets) {
    let dataRow = 0;
    ws.eachRow((row, n) => {
      if (dataRow) return;
      row.eachCell((c) => {
        for (const m of cellText(c.value).matchAll(TOKEN_RE)) if (isRowToken(m[1])) dataRow = n;
      });
    });
    const count = data.rows.length;
    if (dataRow) {
      if (count > 1) ws.duplicateRow(dataRow, count - 1, true);
      if (count === 0) ws.getRow(dataRow).eachCell((c) => { c.value = null; });
      for (let i = 0; i < count; i++) {
        ws.getRow(dataRow + i).eachCell({ includeEmpty: false }, (c) => fillCell(c, { ...data.header, ...data.rows[i] }));
      }
    }
    ws.eachRow((row, n) => {
      if (dataRow && n >= dataRow && n < dataRow + Math.max(count, 1)) return;
      row.eachCell((c) => fillCell(c, data.header));
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---------- Mẫu báo cáo có sẵn ----------

type Col = [header: string, token: string, width: number];

export const BUILTIN_REPORTS = {
  DS_LOP: "Danh sách lớp & liên lạc phụ huynh",
  TAI_KHOAN: "Danh sách tài khoản học sinh & phụ huynh",
  CHUYEN_CAN: "Thống kê chuyên cần, nề nếp",
  BANG_DIEM: "Bảng điểm tổng hợp",
  TONG_KET: "Tổng kết học tập & rèn luyện",
} as const;
export type BuiltinReport = keyof typeof BUILTIN_REPORTS;

const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
};

async function makeTemplate(title: string, cols: Col[], note?: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Báo cáo", {
    pageSetup: { paperSize: 9, orientation: cols.length > 9 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = cols.map(([, , w]) => ({ width: w }));
  const last = cols.length;
  const half = Math.max(1, Math.floor(last / 2));
  ws.mergeCells(1, 1, 1, half);
  ws.getCell(1, 1).value = "{{so}}";
  ws.mergeCells(2, 1, 2, half);
  ws.getCell(2, 1).value = "{{truong}}";
  ws.getCell(2, 1).font = { bold: true };
  ws.getRow(1).alignment = ws.getRow(2).alignment = { horizontal: "center" };
  ws.mergeCells(4, 1, 4, last);
  ws.getCell(4, 1).value = title;
  ws.getCell(4, 1).font = { bold: true, size: 14 };
  ws.mergeCells(5, 1, 5, last);
  ws.getCell(5, 1).value = "Lớp {{lop}} — {{ky}} — Năm học {{namhoc}} — GVCN: {{gvcn}} — Sĩ số: {{siso}}";
  ws.getRow(4).alignment = ws.getRow(5).alignment = { horizontal: "center" };
  if (note) {
    ws.mergeCells(6, 1, 6, last);
    ws.getCell(6, 1).value = note;
    ws.getCell(6, 1).font = { italic: true };
    ws.getCell(6, 1).alignment = { horizontal: "center" };
  }
  const head = ws.getRow(7);
  const tok = ws.getRow(8);
  cols.forEach(([h, t], i) => {
    const hc = head.getCell(i + 1);
    hc.value = h;
    hc.font = { bold: true };
    hc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    hc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F5" } };
    hc.border = THIN;
    const tc = tok.getCell(i + 1);
    tc.value = `{{${t}}}`;
    tc.border = THIN;
    if (t.startsWith("diem_") || t === "tbcm") { tc.numFmt = "0.0"; tc.alignment = { horizontal: "center" }; }
    else if (["stt", "vang_p", "vang_kp", "vang", "muon", "khen", "vipham", "gioitinh", "ngaysinh", "hoctap", "renluyen"].includes(t))
      tc.alignment = { horizontal: "center" };
  });
  head.height = 32;
  // Khối chữ ký (không gộp ô để không bị lệch khi chèn dòng)
  const sig = Math.max(1, last - 2);
  ws.getCell(10, sig).value = "{{ngay_ky}}";
  ws.getCell(10, sig).font = { italic: true };
  ws.getCell(11, sig).value = "GIÁO VIÊN CHỦ NHIỆM";
  ws.getCell(11, sig).font = { bold: true };
  ws.getCell(15, sig).value = "{{gvcn}}";
  ws.getCell(15, sig).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function builtinTemplate(key: BuiltinReport, schoolId: string) {
  const base: Col[] = [["STT", "stt", 5], ["Mã HS", "ma", 13], ["Họ và tên", "hoten", 26]];
  switch (key) {
    case "DS_LOP":
      return makeTemplate("DANH SÁCH HỌC SINH", [
        ...base, ["Ngày sinh", "ngaysinh", 12], ["Giới tính", "gioitinh", 8], ["Dân tộc", "dantoc", 9],
        ["Địa chỉ", "diachi", 30], ["Phụ huynh", "phuhuynh", 22], ["Quan hệ", "quanhe", 10], ["SĐT", "sdt_ph", 13],
      ]);
    case "TAI_KHOAN":
      return makeTemplate("DANH SÁCH TÀI KHOẢN", [
        ...base, ["Tài khoản học sinh", "tk_hs", 18], ["Tài khoản phụ huynh", "tk_ph", 18], ["Phụ huynh", "phuhuynh", 22],
      ], "Mật khẩu ban đầu: {{matkhau}} — bắt buộc đổi khi đăng nhập lần đầu");
    case "CHUYEN_CAN":
      return makeTemplate("THỐNG KÊ CHUYÊN CẦN, NỀ NẾP", [
        ...base, ["Vắng có phép", "vang_p", 9], ["Vắng không phép", "vang_kp", 9], ["Tổng vắng", "vang", 8],
        ["Đi muộn", "muon", 8], ["Khen thưởng", "khen", 9], ["Vi phạm", "vipham", 9],
      ]);
    case "BANG_DIEM": {
      const subjects = await db.subject.findMany({ where: { schoolId, active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
      return makeTemplate("BẢNG ĐIỂM TỔNG HỢP", [
        ...base,
        ...subjects.map((s) => [s.name, `diem_${s.code}`, 7] as Col),
        ["TB các môn", "tbcm", 8], ["Học tập", "hoctap", 10],
      ]);
    }
    case "TONG_KET":
      return makeTemplate("TỔNG KẾT HỌC TẬP VÀ RÈN LUYỆN", [
        ...base, ["Vắng P", "vang_p", 7], ["Vắng KP", "vang_kp", 7], ["Học tập", "hoctap", 10],
        ["Rèn luyện", "renluyen", 10], ["Nhận xét của GVCN", "nhanxet", 40],
      ]);
  }
}
