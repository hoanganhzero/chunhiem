import "server-only";
import { db } from "./db";
import { CLASS_ROLES, DEFAULT_CRITERIA, type ClassRole } from "./constants";
import { toDay } from "./utils";

const DAY = 86400000;

/** Thứ Hai đầu tuần (00:00 UTC theo ngày giờ Việt Nam). */
export function weekStart(d: Date = toDay()) {
  const day = d.getUTCDay(); // 0 = CN
  return new Date(d.getTime() - ((day + 6) % 7) * DAY);
}
export function weekRange(start: Date) {
  return { gte: start, lt: new Date(start.getTime() + 7 * DAY) };
}
export function weekLabel(start: Date) {
  const end = new Date(start.getTime() + 6 * DAY);
  const f = (x: Date) => `${x.getUTCDate()}/${x.getUTCMonth() + 1}`;
  return `${f(start)} – ${f(end)}`;
}
export function weekFromParam(p: string | undefined) {
  if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return weekStart(new Date(p + "T00:00:00Z"));
  return weekStart();
}

/** Tiêu chí tự áp dụng khi điểm danh (GVCN chỉnh điểm hoặc tắt được trong phần Tiêu chí). */
export const AUTO_CRITERIA = [
  { auto: "UNEXCUSED", name: "Vắng học không phép", points: -5 },
  { auto: "LATE", name: "Đi học muộn", points: -2 },
] as const;

/** Tạo bộ tiêu chí mặc định cho lớp nếu chưa có, và bảo đảm có 2 tiêu chí tự động theo điểm danh. */
export async function ensureCriteria(classId: string) {
  const n = await db.emulationCriterion.count({ where: { classId } });
  if (!n) {
    await db.emulationCriterion.createMany({
      data: DEFAULT_CRITERIA.map(([name, category, points], order) => ({ classId, name, category, points, order })),
    });
  }
  for (const a of AUTO_CRITERIA) {
    if (await db.emulationCriterion.count({ where: { classId, auto: a.auto } })) continue;
    const same = await db.emulationCriterion.findFirst({ where: { classId, name: a.name } });
    if (same) await db.emulationCriterion.update({ where: { id: same.id }, data: { auto: a.auto } });
    else await db.emulationCriterion.create({ data: { classId, name: a.name, category: "NE_NEP", points: a.points, auto: a.auto, order: -1 } });
  }
}

/**
 * Đồng bộ điểm thi đua tự động theo điểm danh của một ngày: vắng không phép / đi muộn → trừ điểm.
 * Ghi lại toàn bộ ghi nhận tự động của ngày đó, nên sửa điểm danh (vd. muộn → có mặt) sẽ tự hoàn điểm, không trừ hai lần.
 */
export async function syncAttendanceEmulation(classId: string, date: Date, statuses: Map<string, string>, byUserId: string) {
  await ensureCriteria(classId);
  const rules = await db.emulationCriterion.findMany({ where: { classId, active: true, auto: { not: null } } });
  const data = [...statuses].flatMap(([studentId, status]) => {
    const c = rules.find((r) => r.auto === status);
    return c
      ? [{ classId, studentId, criterionId: c.id, label: c.name, category: c.category, points: c.points, date,
           status: "APPROVED", source: "ATTENDANCE", note: "Tự động từ điểm danh", recordedById: byUserId }]
      : [];
  });
  await db.$transaction([
    db.emulationRecord.deleteMany({ where: { classId, date, source: "ATTENDANCE", studentId: { in: [...statuses.keys()] } } }),
    db.emulationRecord.createMany({ data }),
  ]);
}

/**
 * Học sinh có được ghi thi đua không, và ghi được cho ai.
 * Tổ trưởng: thành viên tổ mình; lớp trưởng / lớp phó / bí thư: cả lớp. Không tự ghi cho bản thân.
 */
export async function recorderScope(studentUserId: string) {
  const me = await db.student.findUnique({ where: { userId: studentUserId } });
  if (!me?.classRole || !(me.classRole in CLASS_ROLES) || me.status !== "ACTIVE") return null;
  const role = me.classRole as ClassRole;
  const scope = CLASS_ROLES[role].scope;
  if (scope === "group" && !me.groupId) return null;
  const targets = await db.student.findMany({
    where: { classId: me.classId, status: "ACTIVE", id: { not: me.id }, ...(scope === "group" ? { groupId: me.groupId } : {}) },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, groupId: true },
  });
  return { me, role, targets };
}

export type Leaderboard = Awaited<ReturnType<typeof leaderboard>>;

/** Bảng thi đua của lớp trong một tuần: điểm từng học sinh, từng tổ, tiến bộ so với tuần trước. */
export async function leaderboard(classId: string, start: Date) {
  const prevStart = new Date(start.getTime() - 7 * DAY);
  const [students, groups, cur, prev] = await Promise.all([
    db.student.findMany({ where: { classId, status: "ACTIVE" }, select: { id: true, fullName: true, groupId: true } }),
    db.classGroup.findMany({ where: { classId }, orderBy: { order: "asc" } }),
    db.emulationRecord.groupBy({ by: ["studentId"], where: { classId, status: "APPROVED", date: weekRange(start) }, _sum: { points: true } }),
    db.emulationRecord.groupBy({ by: ["studentId"], where: { classId, status: "APPROVED", date: weekRange(prevStart) }, _sum: { points: true } }),
  ]);
  const pts = (rows: typeof cur, id: string) => rows.find((r) => r.studentId === id)?._sum.points ?? 0;
  const people = students
    .map((s) => ({ ...s, points: pts(cur, s.id), prev: pts(prev, s.id) }))
    .map((s) => ({ ...s, delta: s.points - s.prev }))
    .sort((a, b) => b.points - a.points || a.fullName.localeCompare(b.fullName, "vi"));
  const teams = groups
    .map((g) => {
      const members = people.filter((p) => p.groupId === g.id);
      const total = members.reduce((n, p) => n + p.points, 0);
      return { id: g.id, name: g.name, members: members.length, total, avg: members.length ? Math.round((total / members.length) * 10) / 10 : 0 };
    })
    .sort((a, b) => b.avg - a.avg || b.total - a.total);
  const improved = people.filter((p) => p.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const stars = people.filter((p) => p.points > 0).slice(0, 3);
  return { people, teams, improved, stars };
}

export const BADGES = {
  STAR: { icon: "🌟", label: "Ngôi sao tuần", desc: "Top 3 điểm thi đua của lớp tuần trước" },
  RISING: { icon: "🚀", label: "Tiến bộ vượt bậc", desc: "Điểm thi đua tăng mạnh so với tuần trước nữa" },
  ATTEND: { icon: "📅", label: "Chuyên cần", desc: "Không vắng, không đi muộn trong 30 ngày" },
  ACTIVE: { icon: "🙋", label: "Tích cực xây dựng bài", desc: "Từ 5 lần phát biểu / điểm tốt trong 30 ngày" },
  KIND: { icon: "💛", label: "Việc tốt", desc: "Được ghi nhận việc tốt, giúp bạn" },
  CLEAN: { icon: "✅", label: "Nề nếp tốt", desc: "Không bị trừ điểm nề nếp trong 30 ngày" },
} as const;
export type BadgeKey = keyof typeof BADGES;
