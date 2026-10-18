/** Ngày hiện tại theo giờ Việt Nam, chuẩn hoá về 00:00 UTC để lưu/so sánh theo ngày. */
export function toDay(d: Date = new Date()) {
  const s = d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }); // yyyy-mm-dd
  return new Date(s + "T00:00:00Z");
}

export function dayFromParam(param: string | undefined) {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return new Date(param + "T00:00:00Z");
  return toDay();
}

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return d.toLocaleDateString("vi-VN", { timeZone: "UTC" });
}

export function str(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(form: FormData, key: string) {
  return str(form, key) || null;
}

/** Parse CSV đơn giản (hỗ trợ dấu ngoặc kép, dấu phẩy hoặc chấm phẩy). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((x) => x)) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x)) rows.push(row);
  return rows;
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Đọc ngày dạng dd/mm/yyyy hoặc yyyy-mm-dd */
export function parseDob(s: string): Date | null {
  if (!s) return null;
  // Số seri ngày của Excel (vd 40179 = 01/01/2010) khi ô ngày bị định dạng văn bản / số
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    if (n > 10000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000);
  }
  let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return null;
}

/** Sắp xếp họ tên kiểu Việt Nam: theo tên (từ cuối), rồi họ đệm. */
export function vnNameCompare(a: string, b: string) {
  const key = (s: string) => {
    const parts = s.trim().split(/\s+/);
    return [parts[parts.length - 1], s];
  };
  const [ta, fa] = key(a);
  const [tb, fb] = key(b);
  return ta.localeCompare(tb, "vi") || fa.localeCompare(fb, "vi");
}
