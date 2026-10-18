import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";
import type { Role } from "./constants";

export type CurrentUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
  schoolId: string | null;
  schoolName: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { school: true },
  });
  if (!user || !user.active) return null;
  if (user.school && !user.school.active) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role as Role,
    schoolId: user.schoolId,
    schoolName: user.school?.name ?? null,
  };
});

export async function requireUser(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect("/dashboard");
  return user;
}

/** Quản trị trường — trả về schoolId của trường đang quản lý. */
export async function requireSchoolAdmin() {
  const user = await requireUser("SCHOOL_ADMIN");
  return { user, schoolId: user.schoolId! };
}

/**
 * Kiểm tra quyền truy cập một lớp:
 *  - SUPER_ADMIN: mọi lớp
 *  - SCHOOL_ADMIN: lớp thuộc trường mình
 *  - TEACHER: chỉ lớp mình chủ nhiệm
 */
export async function requireClassAccess(classId: string) {
  const user = await requireUser();
  const cls = await db.class.findUnique({
    where: { id: classId },
    include: { academicYear: true, homeroomTeacher: { select: { id: true, name: true } } },
  });
  if (!cls) notFound();
  const allowed =
    user.role === "SUPER_ADMIN" ||
    (user.role === "SCHOOL_ADMIN" && cls.schoolId === user.schoolId) ||
    (user.role === "TEACHER" && cls.homeroomTeacherId === user.id);
  if (!allowed) notFound();
  return { user, cls };
}

export async function requireStudentAccess(studentId: string) {
  const student = await db.student.findUnique({ where: { id: studentId } });
  if (!student) notFound();
  const { user, cls } = await requireClassAccess(student.classId);
  return { user, cls, student };
}

/** Học sinh xem hồ sơ của chính mình, phụ huynh xem hồ sơ của con. */
export async function requireFamilyAccess(studentId: string) {
  const user = await requireUser("STUDENT", "PARENT");
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: { class: { include: { academicYear: true, homeroomTeacher: { select: { name: true, phone: true } } } } },
  });
  if (!student) notFound();
  const allowed =
    (user.role === "STUDENT" && student.userId === user.id) ||
    (user.role === "PARENT" && student.parentUserId === user.id);
  if (!allowed) notFound();
  return { user, student };
}
