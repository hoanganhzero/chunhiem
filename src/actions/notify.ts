"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { NOTIFY_KINDS, notify, pushEnabled } from "@/lib/notify";
import type { ActionResult } from "./types";

type SubJson = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Lưu đăng ký nhận thông báo đẩy của thiết bị hiện tại. */
export async function savePushSubscription(sub: SubJson, userAgent: string) {
  const user = await requireUser();
  if (!sub.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Đăng ký không hợp lệ" };
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 300) },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return { ok: true };
}

export async function sendTestPush(): Promise<ActionResult> {
  const user = await requireUser();
  if (!pushEnabled) return { error: "Máy chủ chưa cấu hình khoá VAPID" };
  const n = await db.pushSubscription.count({ where: { userId: user.id } });
  if (!n) return { error: "Thiết bị này chưa bật thông báo" };
  await notify([user.id], { kind: "MESSAGE", title: "🔔 Thông báo thử", body: "Bạn sẽ nhận thông báo như thế này trên điện thoại.", url: "/notifications" });
  return { ok: `Đã gửi thử tới ${n} thiết bị` };
}

export async function saveNotifyPrefs(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const off = Object.keys(NOTIFY_KINDS).filter((k) => form.get(`k_${k}`) !== "on");
  await db.user.update({ where: { id: user.id }, data: { notifyOff: off.join(",") } });
  revalidatePath("/account");
  return { ok: "Đã lưu lựa chọn thông báo" };
}

export async function markNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
}
