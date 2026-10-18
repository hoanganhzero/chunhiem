"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/actions/notify";

/** Đánh dấu đã đọc sau khi danh sách hiển thị, rồi làm mới để chuông cập nhật số đếm. */
export function MarkRead({ unread }: { unread: number }) {
  const router = useRouter();
  useEffect(() => {
    if (unread) markNotificationsRead().then(() => router.refresh());
  }, [unread, router]);
  return null;
}
