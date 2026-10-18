import "server-only";
import webpush from "web-push";
import { after } from "next/server";
import { db } from "./db";

/** Các loại thông báo — người dùng tắt / bật từng loại trong trang Tài khoản. */
export const NOTIFY_KINDS = {
  ATTENDANCE: "Vắng học, đi muộn",
  PRAISE: "Được khen, cộng điểm thi đua",
  WARNING: "Bị nhắc nhở, trừ điểm",
  MESSAGE: "Tin nhắn",
  REPORT: "Báo cáo định kỳ",
  GOAL: "Mục tiêu rèn luyện",
  ANNOUNCE: "Thông báo của lớp / trường",
  FEEDBACK: "Phụ huynh xác nhận, phản hồi, cam kết",
} as const;
export type NotifyKind = keyof typeof NOTIFY_KINDS;
export type Payload = { kind: NotifyKind; title: string; body: string; url?: string };

/** Chuẩn Web Push chỉ nhận mailto: hoặc https: — nhập email trần thì tự thêm mailto:, giá trị khác dùng mặc định */
function vapidSubject() {
  const raw = process.env.VAPID_SUBJECT?.trim() ?? "";
  if (/^(mailto:|https:\/\/)/i.test(raw)) return raw;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return `mailto:${raw}`;
  if (raw) console.warn("VAPID_SUBJECT phải là mailto:email hoặc https://… — đang dùng giá trị mặc định");
  return "mailto:admin@example.com";
}

const vapid = {
  publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? "",
  privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? "",
  subject: vapidSubject(),
};
let configured = false;
if (vapid.publicKey && vapid.privateKey) {
  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    configured = true;
  } catch (e) {
    // Khoá dán sai (thiếu ký tự, có dấu nháy…) không được làm sập trang: chỉ tắt thông báo đẩy
    console.error("Khoá VAPID không hợp lệ, tắt thông báo đẩy:", (e as Error).message);
  }
}
export const pushEnabled = configured;
export const vapidPublicKey = configured ? vapid.publicKey : "";

/**
 * Gửi thông báo: lưu vào hộp thông báo trong ứng dụng, rồi gửi thông báo đẩy tới các thiết bị đã đăng ký.
 * Phần đẩy chạy sau khi trả phản hồi (next/server `after`) nên không làm chậm thao tác của giáo viên.
 */
export async function notify(userIds: (string | null | undefined)[], p: Payload) {
  const ids = [...new Set(userIds.filter(Boolean) as string[])];
  if (!ids.length) return;
  const users = await db.user.findMany({ where: { id: { in: ids }, active: true }, select: { id: true, notifyOff: true } });
  const targets = users.filter((u) => !u.notifyOff.split(",").includes(p.kind)).map((u) => u.id);
  if (!targets.length) return;
  await db.notification.createMany({
    data: targets.map((userId) => ({ userId, kind: p.kind, title: p.title, body: p.body, url: p.url ?? null })),
  });
  if (!pushEnabled) return;
  try {
    after(() => sendPush(targets, p));
  } catch {
    void sendPush(targets, p); // ngoài phạm vi request (vd. script)
  }
}

export async function sendPush(userIds: string[], p: Payload) {
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const body = JSON.stringify({ title: p.title, body: p.body, url: p.url ?? "/dashboard", tag: p.kind });
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400, timeout: 10000 }),
    ),
  );
  // Thiết bị đã gỡ / hết hạn đăng ký → xoá
  const gone = subs.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
  });
  if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone.map((s) => s.id) } } });
  return { sent: results.filter((r) => r.status === "fulfilled").length, failed: results.filter((r) => r.status === "rejected").length };
}

type Family = { id: string; fullName: string; userId: string | null; parentUserId: string | null };

/** Thông báo tới phụ huynh (và học sinh nếu withStudent) của một học sinh. */
export function notifyFamily(s: Family, { path, ...p }: Omit<Payload, "url"> & { path?: string }, withStudent = false) {
  return notify([s.parentUserId, withStudent ? s.userId : null], { ...p, url: `/portal/${s.id}${path ?? ""}` });
}

/** Thông báo tới GVCN của lớp có học sinh này. */
export async function notifyHomeroom(studentId: string, { path, url, ...p }: Omit<Payload, "url"> & { path?: string; url?: string }) {
  const s = await db.student.findUnique({ where: { id: studentId }, select: { classId: true, class: { select: { homeroomTeacherId: true } } } });
  if (!s?.class.homeroomTeacherId) return;
  await notify([s.class.homeroomTeacherId], { ...p, url: url ?? `/classes/${s.classId}${path ?? ""}` });
}

/** Thông báo khen / nhắc nhở khi một ghi nhận thi đua hoặc nề nếp có hiệu lực. */
export async function notifyRecords(records: { studentId: string; label: string; points: number; positive?: boolean }[]) {
  if (!records.length) return;
  const students = await db.student.findMany({
    where: { id: { in: [...new Set(records.map((r) => r.studentId))] } },
    select: { id: true, fullName: true, userId: true, parentUserId: true },
  });
  for (const r of records) {
    const s = students.find((x) => x.id === r.studentId);
    if (!s) continue;
    const pts = r.points ? ` (${r.points > 0 ? "+" : ""}${r.points} điểm)` : "";
    if (r.positive ?? r.points >= 0) {
      await notifyFamily(s, { kind: "PRAISE", title: `🌟 ${s.fullName} được khen`, body: `${r.label}${pts}`, path: "/progress" }, true);
    } else {
      await notifyFamily(s, { kind: "WARNING", title: `⚠️ ${s.fullName} được nhắc nhở`, body: `${r.label}${pts}. Gia đình động viên con khắc phục nhé.`, path: "/progress" });
    }
  }
}
