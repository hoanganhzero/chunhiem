// Tính điểm và xếp loại kết quả học tập theo Thông tư 22/2021/TT-BGDĐT.

export type GradeRow = { kind: string; idx: number; score: number };
export const MAX_TX = 5;

export function round1(x: number) {
  return Math.round((x + Number.EPSILON) * 10) / 10;
}

/** ĐTB môn học kỳ = (Σ ĐĐGtx + 2·ĐĐGgk + 3·ĐĐGck) / (số ĐĐGtx + 5). Thiếu GK hoặc CK → null. */
export function semesterAverage(grades: GradeRow[]): number | null {
  const gk = grades.find((g) => g.kind === "GK")?.score;
  const ck = grades.find((g) => g.kind === "CK")?.score;
  if (gk == null || ck == null) return null;
  const tx = grades.filter((g) => g.kind === "TX").map((g) => g.score);
  return round1((tx.reduce((a, b) => a + b, 0) + 2 * gk + 3 * ck) / (tx.length + 5));
}

/** Môn đánh giá bằng nhận xét: true = Đạt, false = Chưa đạt, null = chưa đánh giá */
export function commentResult(grades: GradeRow[]): boolean | null {
  const dg = grades.find((g) => g.kind === "DG");
  return dg ? dg.score >= 1 : null;
}

/** ĐTB môn cả năm = (ĐTB HK1 + 2·ĐTB HK2) / 3 */
export function yearAverage(hk1: number | null, hk2: number | null) {
  return hk1 == null || hk2 == null ? null : round1((hk1 + 2 * hk2) / 3);
}

export type SubjectResult = { type: "SCORE"; value: number | null } | { type: "COMMENT"; value: boolean | null };

/** Kết quả một môn trong kỳ (semester 0 = cả năm). */
export function subjectResult(type: string, grades: (GradeRow & { semester: number })[], semester: 0 | 1 | 2): SubjectResult {
  const of = (hk: number) => grades.filter((g) => g.semester === hk);
  if (type === "COMMENT") {
    // Cả năm: căn cứ kết quả học kỳ II
    return { type: "COMMENT", value: commentResult(of(semester === 0 ? 2 : semester)) };
  }
  if (semester === 0) return { type: "SCORE", value: yearAverage(semesterAverage(of(1)), semesterAverage(of(2))) };
  return { type: "SCORE", value: semesterAverage(of(semester)) };
}

export function formatResult(r: SubjectResult | undefined) {
  if (!r || r.value == null) return "";
  if (r.type === "COMMENT") return r.value ? "Đ" : "CĐ";
  return r.value.toFixed(1);
}

/**
 * Xếp loại kết quả học tập (TT22, Điều 9). Trả về null nếu còn môn chưa có kết quả.
 *  Tốt: môn nhận xét đều Đạt; môn tính điểm đều ≥ 6,5 và ít nhất 6 môn ≥ 8,0
 *  Khá: môn nhận xét đều Đạt; môn tính điểm đều ≥ 5,0 và ít nhất 6 môn ≥ 6,5
 *  Đạt: tối đa 1 môn nhận xét Chưa đạt; ít nhất 6 môn ≥ 5,0 và không môn nào < 3,5
 */
export function classify(results: SubjectResult[]): "TOT" | "KHA" | "DAT" | "CHUA_DAT" | null {
  if (!results.length || results.some((r) => r.value == null)) return null;
  const scores = results.filter((r) => r.type === "SCORE").map((r) => r.value as number);
  const comments = results.filter((r) => r.type === "COMMENT").map((r) => r.value as boolean);
  const need = Math.min(6, scores.length);
  const count = (min: number) => scores.filter((s) => s >= min).length;
  const allPass = comments.every(Boolean);
  if (allPass && scores.every((s) => s >= 6.5) && count(8) >= need) return "TOT";
  if (allPass && scores.every((s) => s >= 5) && count(6.5) >= need) return "KHA";
  if (comments.filter((c) => !c).length <= 1 && count(5) >= need && scores.every((s) => s >= 3.5)) return "DAT";
  return "CHUA_DAT";
}

/** Trung bình các môn tính điểm (tham khảo — TT22 không dùng để xếp loại). */
export function overallAverage(results: SubjectResult[]) {
  const s = results.filter((r) => r.type === "SCORE" && r.value != null).map((r) => r.value as number);
  return s.length ? round1(s.reduce((a, b) => a + b, 0) / s.length) : null;
}
