import "server-only";
import { db } from "./db";
import { MANAGER_ROLES, SCHOOL_VIEW_ROLES, terms } from "./constants";
import type { CurrentUser } from "./auth";
import type { IconName } from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };
export type NavGroup = { title?: string; items: NavItem[] };
export type Nav = { groups: NavGroup[]; bottom: NavItem[] };

/** Dựng menu theo vai trò: nhóm cho thanh bên (máy tính) + tối đa 4 mục cho thanh dưới (điện thoại). */
export async function buildNav(user: CurrentUser): Promise<Nav> {
  const t = terms(user.schoolType);

  if (user.role === "SUPER_ADMIN") {
    const items: NavItem[] = [
      { href: "/dashboard", label: "Tổng quan", icon: "dashboard" },
      { href: "/admin/schools", label: "Đơn vị", icon: "building" },
    ];
    return { groups: [{ items }], bottom: items };
  }

  if (user.role === "STUDENT" || user.role === "PARENT") {
    const kids = await db.student.findMany({
      where: user.role === "PARENT" ? { parentUserId: user.id } : { userId: user.id },
      orderBy: { fullName: "asc" },
      include: { _count: { select: { messages: { where: { fromFamily: false, read: false } } } } },
    });
    const groups: NavGroup[] = kids.map((k) => ({
      title: user.role === "PARENT" ? k.fullName : undefined,
      items: [
        { href: `/portal/${k.id}`, label: "Kết quả học tập", icon: "home", exact: true },
        { href: `/portal/${k.id}/messages`, label: user.role === "PARENT" ? "Liên lạc" : "Thông báo", icon: "messages",
          badge: user.role === "PARENT" ? k._count.messages : undefined },
      ],
    }));
    const first = kids[0];
    const unread = kids.reduce((n, k) => n + k._count.messages, 0);
    const bottom: NavItem[] = first
      ? [
          { href: `/portal/${first.id}`, label: "Trang chủ", icon: "home", exact: true },
          { href: `/portal/${first.id}/messages`, label: user.role === "PARENT" ? "Liên lạc" : "Thông báo", icon: "messages",
            badge: user.role === "PARENT" ? unread : undefined },
          { href: "/account", label: "Tài khoản", icon: "accounts" },
        ]
      : [{ href: "/account", label: "Tài khoản", icon: "accounts" }];
    return { groups, bottom };
  }

  const groups: NavGroup[] = [];
  const bottom: NavItem[] = [];
  const home: NavItem = { href: "/dashboard", label: "Tổng quan", icon: "dashboard" };
  groups.push({ items: [home] });
  bottom.push({ ...home, label: "Trang chủ", icon: "home" });

  if (SCHOOL_VIEW_ROLES.includes(user.role)) {
    const view: NavItem[] = [
      { href: "/school/stats", label: "Thống kê học tập", icon: "stats" },
      { href: "/school/announcements", label: `Thông báo toàn ${t.unitLower}`, icon: "announce" },
    ];
    groups.push({ title: t.unit, items: view });
    if (user.role === "LEADER") bottom.push({ ...view[0], label: "Thống kê" }, { ...view[1], label: "Thông báo" });
  }
  if (MANAGER_ROLES.includes(user.role)) {
    const manage: NavItem[] = [
      { href: "/school/classes", label: "Năm học & lớp", icon: "school" },
      { href: "/school/import", label: `Nhập ${t.learnerLower}`, icon: "upload" },
      { href: "/school/teachers", label: "Cán bộ, giáo viên", icon: "teachers" },
      { href: "/school/subjects", label: "Môn học", icon: "subjects" },
      { href: "/school/reports", label: "Mẫu báo cáo", icon: "reports" },
    ];
    if (user.role === "SCHOOL_ADMIN") manage.push({ href: "/school/settings", label: `Cài đặt ${t.unitLower}`, icon: "settings" });
    groups.push({ title: "Quản lý", items: manage });
    bottom.push({ ...manage[0], label: "Lớp học" }, { ...manage[1], label: "Nhập liệu" });
  }

  // Lớp chủ nhiệm (giáo viên, hoặc cán bộ kiêm chủ nhiệm)
  const classes = await db.class.findMany({
    where: { homeroomTeacherId: user.id, academicYear: { isCurrent: true } },
    orderBy: { name: "asc" },
  });
  if (classes.length) {
    const unread = await db.message.groupBy({
      by: ["studentId"],
      where: { fromFamily: true, read: false, student: { classId: { in: classes.map((c) => c.id) } } },
      _count: true,
    });
    const students = await db.student.findMany({ where: { id: { in: unread.map((u) => u.studentId) } }, select: { id: true, classId: true } });
    const unreadOf = (cid: string) =>
      unread.filter((u) => students.find((s) => s.id === u.studentId)?.classId === cid).reduce((n, u) => n + u._count, 0);
    for (const c of classes) {
      const base = `/classes/${c.id}`;
      groups.push({
        title: `Lớp ${c.name}`,
        items: [
          { href: base, label: t.learner, icon: "students", exact: true },
          { href: `${base}/attendance`, label: "Điểm danh", icon: "attendance" },
          { href: `${base}/conduct`, label: "Nề nếp", icon: "conduct" },
          { href: `${base}/grades`, label: "Sổ điểm", icon: "grades" },
          { href: `${base}/messages`, label: "Liên lạc", icon: "messages", badge: unreadOf(c.id) },
          { href: `${base}/reports`, label: "Báo cáo", icon: "reports" },
        ],
      });
    }
    if (user.role === "TEACHER") {
      const base = `/classes/${classes[0].id}`;
      bottom.push(
        { href: `${base}/attendance`, label: "Điểm danh", icon: "attendance" },
        { href: `${base}/grades`, label: "Sổ điểm", icon: "grades" },
        { href: `${base}/messages`, label: "Liên lạc", icon: "messages", badge: classes.reduce((n, c) => n + unreadOf(c.id), 0) },
      );
    }
  }
  return { groups, bottom: bottom.slice(0, 4) };
}
