import "server-only";
import ExcelJS from "exceljs";
import { parseCsv, parseDob } from "./utils";
import { RELATIONS } from "./constants";

/** Bỏ dấu, ký tự đặc biệt để so khớp tiêu đề cột linh hoạt. */
export function normKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) {
    return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("").trim();
    if ("text" in v) return String(v.text).trim();
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    return "";
  }
  return String(v).trim();
}

/**
 * Đọc bảng từ tệp .xlsx hoặc .csv. Tự tìm dòng tiêu đề (trong 15 dòng đầu) có chứa các cột bắt buộc.
 * Trả về danh sách bản ghi { field: value } theo bảng ánh xạ `columns` (field → các tên cột chấp nhận).
 */
export async function readTable<F extends string>(
  file: File,
  columns: Record<F, string[]>,
  required: NoInfer<F>[],
): Promise<{ rows: { row: number; values: Record<F, string> }[]; error?: string }> {
  let grid: string[][];
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    grid = parseCsv(await file.text());
  } else if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets.find((w) => !normKey(w.name).startsWith("huongdan")) ?? wb.worksheets[0];
    if (!ws) return { rows: [], error: "Tệp không có trang tính" };
    grid = [];
    ws.eachRow({ includeEmpty: true }, (r, n) => {
      const vals: string[] = [];
      r.eachCell({ includeEmpty: true }, (c, col) => { vals[col - 1] = cellText(c.value); });
      grid[n - 1] = Array.from(vals, (v) => v ?? "");
    });
    grid = Array.from(grid, (r) => r ?? []);
  } else {
    return { rows: [], error: "Chỉ hỗ trợ tệp .xlsx hoặc .csv (Excel 97-2003 .xls hãy lưu lại thành .xlsx)" };
  }

  const aliases = Object.entries(columns).map(([f, names]) => [f, (names as string[]).map(normKey)] as const);
  for (let h = 0; h < Math.min(15, grid.length); h++) {
    // So khớp cả tiêu đề đầy đủ lẫn tiêu đề đã bỏ phần chú thích trong ngoặc, vd "Ngày sinh (dd/mm/yyyy)"
    const full = grid[h].map((c) => normKey(c.replace(/\*/g, "")));
    const short = grid[h].map((c) => normKey(c.replace(/\*/g, "").replace(/\(.*?\)/g, "")));
    const pos = {} as Record<F, number>;
    for (const [f, names] of aliases) {
      let i = full.findIndex((c) => names.includes(c));
      if (i < 0) i = short.findIndex((c) => names.includes(c));
      if (i >= 0) pos[f as F] = i;
    }
    if (!required.every((f) => pos[f] !== undefined)) continue;
    const rows = [];
    for (let r = h + 1; r < grid.length; r++) {
      const line = grid[r];
      if (!line.some((c) => c)) continue;
      const values = {} as Record<F, string>;
      for (const f of Object.keys(columns) as F[]) values[f] = pos[f] !== undefined ? (line[pos[f]] ?? "").trim() : "";
      rows.push({ row: r + 1, values });
    }
    return { rows };
  }
  return { rows: [], error: `Không tìm thấy dòng tiêu đề có các cột bắt buộc. Hãy dùng tệp mẫu.` };
}

// ---------- Nhập học sinh ----------

export const STUDENT_COLUMNS = {
  className: ["Lớp", "Tên lớp"],
  code: ["Mã học sinh", "Mã HS", "Mã định danh", "Mã"],
  fullName: ["Họ và tên", "Họ tên", "Họ tên học sinh"],
  dob: ["Ngày sinh"],
  gender: ["Giới tính"],
  ethnicity: ["Dân tộc"],
  address: ["Địa chỉ", "Nơi ở", "Chỗ ở hiện nay"],
  parentName: ["Họ tên phụ huynh", "Phụ huynh", "Họ tên cha/mẹ", "Họ tên cha mẹ"],
  parentRelation: ["Quan hệ", "Quan hệ với HS"],
  parentPhone: ["SĐT phụ huynh", "Số điện thoại phụ huynh", "SĐT", "Điện thoại", "Số điện thoại"],
  note: ["Ghi chú"],
};

export function toStudentInput(v: Record<keyof typeof STUDENT_COLUMNS, string>) {
  const g = normKey(v.gender);
  const rel = RELATIONS.find((r) => normKey(r) === normKey(v.parentRelation));
  return {
    code: v.code.replace(/\s/g, "").toUpperCase(),
    fullName: v.fullName.replace(/\s+/g, " "),
    dob: parseDob(v.dob),
    gender: g === "nam" ? "NAM" : g === "nu" ? "NU" : null,
    ethnicity: v.ethnicity || null,
    address: v.address || null,
    parentName: v.parentName || null,
    parentRelation: rel ?? (v.parentRelation || null),
    parentPhone: v.parentPhone || null,
    note: v.note || null,
  };
}

// ---------- Nhập giáo viên ----------

export const TEACHER_COLUMNS = {
  name: ["Họ và tên", "Họ tên"],
  username: ["Email", "Tên đăng nhập", "Email (tên đăng nhập)"],
  phone: ["Số điện thoại", "SĐT", "Điện thoại"],
  className: ["Chủ nhiệm lớp", "Lớp chủ nhiệm", "Lớp"],
  role: ["Vai trò"],
};

// ---------- Tệp mẫu ----------

const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E9E" } };
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
};

function styledHeader(ws: ExcelJS.Worksheet, cols: { header: string; width: number; text?: boolean }[]) {
  ws.columns = cols.map((c) => ({ header: c.header, width: c.width, style: c.text ? { numFmt: "@" } : {} }));
  const h = ws.getRow(1);
  h.height = 30;
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEAD_FILL;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = THIN;
  });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function listValidation(ws: ExcelJS.Worksheet, col: string, values: string[], rows = 2000) {
  for (let r = 2; r <= rows; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: "list", allowBlank: true, formulae: [`"${values.join(",")}"`],
      showErrorMessage: true, errorTitle: "Giá trị không hợp lệ", error: `Chọn một trong: ${values.join(", ")}`,
    };
  }
}

function guideSheet(wb: ExcelJS.Workbook, title: string, lines: string[]) {
  const ws = wb.addWorksheet("Hướng dẫn");
  ws.getColumn(1).width = 110;
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF1F4E9E" } };
  lines.forEach((l, i) => {
    const c = ws.getCell(`A${i + 3}`);
    c.value = l;
    c.alignment = { wrapText: true };
    if (/^\d\./.test(l) || l.endsWith(":")) c.font = { bold: l.endsWith(":") };
  });
}

export async function studentTemplate(defaultPassword?: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sách học sinh");
  styledHeader(ws, [
    { header: "Lớp", width: 8, text: true },
    { header: "Mã học sinh *", width: 16, text: true },
    { header: "Họ và tên *", width: 26 },
    { header: "Ngày sinh (dd/mm/yyyy)", width: 14, text: true },
    { header: "Giới tính", width: 9 },
    { header: "Dân tộc", width: 10 },
    { header: "Địa chỉ", width: 30 },
    { header: "Họ tên phụ huynh", width: 24 },
    { header: "Quan hệ", width: 14 },
    { header: "SĐT phụ huynh", width: 14, text: true },
    { header: "Ghi chú", width: 20 },
  ]);
  listValidation(ws, "E", ["Nam", "Nữ"]);
  listValidation(ws, "I", [...RELATIONS]);
  guideSheet(wb, "HƯỚNG DẪN NHẬP DANH SÁCH HỌC SINH", [
    "Cách điền:",
    "1. Nhập dữ liệu ở trang tính \"Danh sách học sinh\", mỗi học sinh một dòng, bắt đầu từ dòng 2. Không đổi tên dòng tiêu đề.",
    "2. Cột có dấu * là bắt buộc: Mã học sinh, Họ và tên.",
    "3. Cột \"Lớp\" chỉ cần khi Quản trị trường nhập cho toàn trường (vd: 10A1). GVCN nhập tại trang lớp có thể bỏ trống.",
    "4. Ngày sinh dạng dd/mm/yyyy, vd: 05/09/2011. Giới tính, Quan hệ: chọn từ danh sách thả xuống.",
    "5. SĐT phụ huynh: 10 số, vd 0901234567 (cột đã định dạng văn bản để giữ số 0 đầu).",
    "6. Có thể dán dữ liệu xuất từ CSDL ngành / SMAS / vnEdu — hệ thống tự nhận cột theo tên tiêu đề.",
    "",
    "Tài khoản được tạo tự động:",
    "• Học sinh: tên đăng nhập = Mã học sinh (chữ thường).",
    "• Phụ huynh: tên đăng nhập = SĐT phụ huynh. Anh chị em trong trường có cùng SĐT dùng chung một tài khoản phụ huynh.",
    "   Không có SĐT → tên đăng nhập = \"ph\" + mã học sinh.",
    `• Mật khẩu ban đầu = mật khẩu mặc định của trường${defaultPassword ? ` (hiện tại: ${defaultPassword})` : ""}. Bắt buộc đổi ở lần đăng nhập đầu tiên.`,
    "",
    "Nhập lại tệp nhiều lần không tạo trùng: học sinh trùng mã sẽ được cập nhật thông tin.",
    "",
    "Ví dụ một dòng:",
    "10A1 | 7901234567 | Nguyễn Văn An | 05/09/2011 | Nam | Kinh | 12 Lê Lợi, Q1 | Nguyễn Văn Bình | Bố | 0901234567 |",
  ]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function teacherTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sách giáo viên");
  styledHeader(ws, [
    { header: "Họ và tên *", width: 26 },
    { header: "Email (tên đăng nhập) *", width: 30, text: true },
    { header: "Số điện thoại", width: 14, text: true },
    { header: "Chủ nhiệm lớp", width: 14, text: true },
    { header: "Vai trò", width: 18 },
  ]);
  listValidation(ws, "E", ["Giáo viên", "Giáo vụ", "Ban Giám hiệu", "Ban Giám đốc", "Quản trị"], 500);
  guideSheet(wb, "HƯỚNG DẪN NHẬP DANH SÁCH GIÁO VIÊN", [
    "1. Mỗi giáo viên một dòng. Cột * là bắt buộc. Email dùng làm tên đăng nhập.",
    "2. \"Chủ nhiệm lớp\": tên lớp trong năm học hiện tại (vd 10A1). Lớp chưa có sẽ được tạo tự động; bỏ trống nếu không chủ nhiệm.",
    "3. \"Vai trò\": Giáo viên (mặc định), Giáo vụ, Ban Giám hiệu / Ban Giám đốc, Quản trị (chỉ tài khoản Quản trị mới cấp được các vai trò ngoài Giáo viên).",
    "4. Mật khẩu ban đầu = mật khẩu mặc định của trường, bắt buộc đổi khi đăng nhập lần đầu.",
    "5. Giáo viên đã có (trùng email) sẽ được cập nhật họ tên, SĐT và phân công chủ nhiệm.",
  ]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(buf: Buffer | ArrayBuffer, fileName: string) {
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
