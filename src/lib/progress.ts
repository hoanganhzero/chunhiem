import "server-only";
import { db } from "./db";
import { subjectResult } from "./grades";
import { BADGES, leaderboard, weekRange, weekStart, type BadgeKey, type Leaderboard } from "./emulation";
import { toDay } from "./utils";

const DAY = 86400000;

export type Change = { label: string; before: number; after: number; betterWhen: "up" | "down"; unit: string };

/**
 * Hồ sơ tiến bộ của một học sinh — để phụ huynh thấy ưu điểm, hạn chế và chuyển biến.
 * So sánh 30 ngày gần nhất với 30 ngày trước đó; điểm môn so HK1 với HK2.
 */
export async function buildProgress(studentId: string, boards?: { last: Leaderboard; prev: Leaderboard }) {
  const student = await db.student.findUniqueOrThrow({ where: { id: studentId }, include: { class: true } });
  const today = toDay();
  const tomorrow = new Date(today.getTime() + DAY);
  const d30 = new Date(today.getTime() - 29 * DAY);
  const d60 = new Date(today.getTime() - 59 * DAY);
  const cur = { gte: d30, lt: tomorrow };
  const prev = { gte: d60, lt: d30 };
  const thisWeek = weekStart(today);
  const weeks = Array.from({ length: 8 }, (_, i) => new Date(thisWeek.getTime() - (7 - i) * 7 * DAY));

  const [recs, att, conduct, subjects, grades, goals, lastWeekBoard, prevWeekBoard] = await Promise.all([
    db.emulationRecord.findMany({ where: { studentId, status: "APPROVED", date: { gte: weeks[0], lt: tomorrow } } }),
    db.attendance.findMany({ where: { studentId, date: { gte: d60, lt: tomorrow }, status: { not: "PRESENT" } } }),
    db.conductRecord.findMany({ where: { studentId, date: { gte: d60, lt: tomorrow } } }),
    db.subject.findMany({ where: { schoolId: student.schoolId, active: true }, orderBy: { order: "asc" } }),
    db.grade.findMany({ where: { studentId, academicYearId: student.class.academicYearId } }),
    db.goal.findMany({ where: { studentId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    boards?.last ?? leaderboard(student.classId, new Date(thisWeek.getTime() - 7 * DAY)),
    boards?.prev ?? leaderboard(student.classId, new Date(thisWeek.getTime() - 14 * DAY)),
  ]);
  const inRange = (d: Date, r: { gte: Date; lt: Date }) => d >= r.gte && d < r.lt;

  // Điểm thi đua 8 tuần
  const weekly = weeks.map((w) => {
    const r = weekRange(w);
    return { start: w, points: recs.filter((x) => inRange(x.date, r)).reduce((n, x) => n + x.points, 0) };
  });

  // Tần suất từng tiêu chí trong 30 ngày
  const freq = (pos: boolean) => {
    const m = new Map<string, number>();
    for (const r of recs) if (inRange(r.date, cur) && (r.points > 0) === pos) m.set(r.label, (m.get(r.label) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const positives = freq(true);
  const negatives = freq(false);

  // Điểm môn: học kỳ có dữ liệu mới nhất, so với kỳ trước
  const avg = (sid: string, type: string, hk: 1 | 2) => {
    const r = subjectResult(type, grades.filter((g) => g.subjectId === sid), hk);
    return r.type === "SCORE" ? r.value : null;
  };
  const hasHk2 = grades.some((g) => g.semester === 2);
  const latest = hasHk2 ? 2 : 1;
  const scored = subjects
    .filter((s) => s.type === "SCORE")
    .map((s) => ({ name: s.name, now: avg(s.id, s.type, latest), before: hasHk2 ? avg(s.id, s.type, 1) : null }))
    .filter((s) => s.now != null) as { name: string; now: number; before: number | null }[];

  const count = <T extends { date: Date }>(xs: T[], r: { gte: Date; lt: Date }, f: (x: T) => boolean) => xs.filter((x) => inRange(x.date, r) && f(x)).length;
  const absent = (x: { status: string }) => x.status === "EXCUSED" || x.status === "UNEXCUSED";
  const late = (x: { status: string }) => x.status === "LATE";
  const negRec = (x: { points: number }) => x.points < 0;
  const posRec = (x: { points: number }) => x.points > 0;

  const changes: Change[] = [
    { label: "Buổi vắng", before: count(att, prev, absent), after: count(att, cur, absent), betterWhen: "down", unit: "buổi" },
    { label: "Lần đi muộn", before: count(att, prev, late), after: count(att, cur, late), betterWhen: "down", unit: "lần" },
    { label: "Lần bị nhắc nhở / trừ điểm", before: count(recs, prev, negRec) + count(conduct, prev, (c) => c.type === "VIOLATION"),
      after: count(recs, cur, negRec) + count(conduct, cur, (c) => c.type === "VIOLATION"), betterWhen: "down", unit: "lần" },
    { label: "Lần được khen / cộng điểm", before: count(recs, prev, posRec) + count(conduct, prev, (c) => c.type === "PRAISE"),
      after: count(recs, cur, posRec) + count(conduct, cur, (c) => c.type === "PRAISE"), betterWhen: "up", unit: "lần" },
  ];
  const subjectChanges = scored.filter((s) => s.before != null).map((s) => ({ name: s.name, before: s.before!, after: s.now }));

  // Ưu điểm & cần cố gắng (câu ngắn, dễ hiểu cho phụ huynh)
  const strengths: string[] = [];
  const limits: string[] = [];
  for (const [label, n] of positives.slice(0, 3)) strengths.push(`${label} (${n} lần trong 30 ngày)`);
  const good = scored.filter((s) => s.now >= 8).sort((a, b) => b.now - a.now);
  if (good.length) strengths.push(`Học tốt: ${good.slice(0, 4).map((s) => `${s.name} ${s.now.toFixed(1)}`).join(", ")}`);
  if (!count(att, cur, (x) => absent(x) || late(x))) strengths.push("Đi học đầy đủ, đúng giờ trong 30 ngày qua");
  for (const c of changes) {
    if (c.betterWhen === "down" && c.after < c.before)
      strengths.push(`Tiến bộ: ${c.label.toLowerCase()} giảm từ ${c.before} xuống ${c.after} so với 30 ngày trước`);
    if (c.betterWhen === "up" && c.after > c.before)
      strengths.push(`Tiến bộ: ${c.label.toLowerCase()} tăng từ ${c.before} lên ${c.after} so với 30 ngày trước`);
  }
  for (const s of subjectChanges) if (s.after - s.before >= 0.5) strengths.push(`${s.name} tăng từ ${s.before.toFixed(1)} lên ${s.after.toFixed(1)}`);

  for (const [label, n] of negatives.slice(0, 3)) limits.push(`${label} (${n} lần trong 30 ngày)`);
  const weak = scored.filter((s) => s.now < 5).sort((a, b) => a.now - b.now);
  const mid = scored.filter((s) => s.now >= 5 && s.now < 6.5).sort((a, b) => a.now - b.now);
  if (weak.length) limits.push(`Chưa đạt yêu cầu: ${weak.map((s) => `${s.name} ${s.now.toFixed(1)}`).join(", ")}`);
  else if (mid.length) limits.push(`Điểm còn thấp: ${mid.slice(0, 3).map((s) => `${s.name} ${s.now.toFixed(1)}`).join(", ")}`);
  const unexcused = count(att, cur, (x) => x.status === "UNEXCUSED");
  if (unexcused) limits.push(`Vắng không phép ${unexcused} buổi trong 30 ngày`);
  for (const c of changes) {
    if (c.after !== c.before && (c.betterWhen === "down" ? c.after > c.before : c.after < c.before) && c.after + c.before > 0)
      limits.push(`${c.label} ${c.betterWhen === "down" ? "tăng" : "giảm"}: ${c.before} → ${c.after} so với 30 ngày trước`);
  }
  for (const s of subjectChanges) if (s.before - s.after >= 0.5) limits.push(`${s.name} giảm từ ${s.before.toFixed(1)} xuống ${s.after.toFixed(1)}`);

  // Huy hiệu
  const badges: BadgeKey[] = [];
  if (lastWeekBoard.stars.some((p) => p.id === studentId)) badges.push("STAR");
  const lw = lastWeekBoard.people.find((p) => p.id === studentId);
  const pw = prevWeekBoard.people.find((p) => p.id === studentId);
  if (lw && pw && lw.points - pw.points >= 5) badges.push("RISING");
  if (!count(att, cur, (x) => absent(x) || late(x))) badges.push("ATTEND");
  if (recs.filter((r) => inRange(r.date, cur) && r.category === "HOC_TAP" && r.points > 0).length >= 5) badges.push("ACTIVE");
  if (recs.some((r) => inRange(r.date, cur) && r.category === "HOAT_DONG" && r.points >= 5) || positives.some(([l]) => /giúp/i.test(l))) badges.push("KIND");
  if (!recs.some((r) => inRange(r.date, cur) && r.category === "NE_NEP" && r.points < 0) && !count(conduct, cur, (c) => c.type === "VIOLATION")) badges.push("CLEAN");

  const timeline = await db.emulationRecord.findMany({
    where: { studentId, status: "APPROVED" }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 15,
  });

  return { weekly, strengths, limits, changes, subjectChanges, badges: badges.map((b) => ({ key: b, ...BADGES[b] })), goals, timeline, latestSemester: latest };
}

/** Tóm tắt ngắn để đưa vào báo cáo định kỳ gửi phụ huynh. */
export function progressSummary(p: Awaited<ReturnType<typeof buildProgress>>) {
  const lines: string[] = [];
  const w = p.weekly[p.weekly.length - 2]; // tuần trước (trọn tuần)
  if (w) lines.push(`• Điểm thi đua tuần trước: ${w.points > 0 ? "+" : ""}${w.points}`);
  if (p.badges.length) lines.push(`• Huy hiệu: ${p.badges.map((b) => `${b.icon} ${b.label}`).join(", ")}`);
  if (p.strengths.length) lines.push(`• Ưu điểm: ${p.strengths.slice(0, 3).join("; ")}`);
  if (p.limits.length) lines.push(`• Cần cố gắng: ${p.limits.slice(0, 3).join("; ")}`);
  const active = p.goals.filter((g) => g.status === "ACTIVE");
  if (active.length) lines.push(`• Mục tiêu đang thực hiện: ${active.map((g) => g.title).join("; ")}`);
  return lines;
}

/** Bảng xếp hạng tuần trước và tuần trước nữa của lớp — tính một lần, dùng cho cả lớp. */
export async function classBoards(classId: string) {
  const w = weekStart(toDay());
  const [last, prev] = await Promise.all([
    leaderboard(classId, new Date(w.getTime() - 7 * DAY)),
    leaderboard(classId, new Date(w.getTime() - 14 * DAY)),
  ]);
  return { last, prev };
}
