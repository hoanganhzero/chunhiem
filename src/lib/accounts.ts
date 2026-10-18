import "server-only";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/** Chuẩn hoá SĐT Việt Nam: bỏ ký tự thừa, +84/84 → 0, bổ sung số 0 bị Excel làm mất. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  if (d.length === 9 && /^[35789]/.test(d)) d = "0" + d;
  return /^0\d{9}$/.test(d) ? d : null;
}

export const studentUsername = (code: string) => code.trim().toLowerCase();
export const fallbackParentUsername = (code: string) => "ph" + code.trim().toLowerCase();

export type StudentInput = {
  code: string;
  fullName: string;
  dob?: Date | null;
  gender?: string | null;
  ethnicity?: string | null;
  address?: string | null;
  parentName?: string | null;
  parentRelation?: string | null;
  parentPhone?: string | null;
  note?: string | null;
};

export type ProvisionItem = { row: number; classId: string; data: StudentInput };

export type ProvisionResult = {
  created: number;
  updated: number;
  studentAccounts: number;
  parentAccounts: number;
  linkedSiblings: number;
  errors: string[];
  warnings: string[];
};

/**
 * Tạo / cập nhật học sinh và đồng thời cấp tài khoản học sinh + phụ huynh.
 *  - Tài khoản học sinh: tên đăng nhập = mã HS
 *  - Tài khoản phụ huynh: tên đăng nhập = SĐT phụ huynh (anh chị em dùng chung 1 tài khoản),
 *    nếu không có SĐT hoặc SĐT đã bị dùng ở nơi khác thì dùng "ph" + mã HS
 *  - Mật khẩu = mật khẩu mặc định của trường, bắt buộc đổi ở lần đăng nhập đầu
 * Học sinh đã có (trùng mã) sẽ được cập nhật thông tin và bổ sung tài khoản còn thiếu.
 */
export async function provisionStudents(opts: {
  schoolId: string;
  items: ProvisionItem[];
  allowMove?: boolean; // cho phép chuyển học sinh sang lớp khác (nhập toàn trường)
  updateInfo?: boolean; // false = chỉ bổ sung tài khoản, không ghi đè thông tin
}): Promise<ProvisionResult> {
  const { schoolId, items, allowMove = false, updateInfo = true } = opts;
  const res: ProvisionResult = { created: 0, updated: 0, studentAccounts: 0, parentAccounts: 0, linkedSiblings: 0, errors: [], warnings: [] };
  if (!items.length) return res;

  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const codes = items.map((i) => i.data.code.toUpperCase());
  const existing = new Map(
    (await db.student.findMany({ where: { schoolId, code: { in: codes } } })).map((s) => [s.code, s]),
  );

  const wanted = new Set<string>();
  for (const { data } of items) {
    wanted.add(studentUsername(data.code));
    wanted.add(fallbackParentUsername(data.code));
    const p = normalizePhone(data.parentPhone);
    if (p) wanted.add(p);
  }
  type U = { id: string; role: string; schoolId: string | null };
  const users = new Map<string, U>(
    (await db.user.findMany({ where: { username: { in: [...wanted] } }, select: { id: true, username: true, role: true, schoolId: true } }))
      .map((u) => [u.username, u]),
  );

  // Băm mật khẩu mặc định một lần cho cả đợt (bcrypt chậm có chủ đích)
  const passwordHash = await bcrypt.hash(school.defaultPassword, 10);
  const newUsers: { id: string; username: string; name: string; phone: string | null; role: string; schoolId: string; passwordHash: string; mustChangePassword: boolean }[] = [];
  const newStudents: Prisma.StudentCreateManyInput[] = [];
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  const seenCodes = new Set<string>();

  const addUser = (username: string, name: string, role: "STUDENT" | "PARENT", phone: string | null) => {
    const u = { id: randomUUID(), username, name, phone, role, schoolId, passwordHash, mustChangePassword: true };
    newUsers.push(u);
    users.set(username, u);
    return u.id;
  };

  for (const { row, classId, data } of items) {
    const code = data.code.trim().toUpperCase();
    const where = row ? `Dòng ${row}` : code;
    if (seenCodes.has(code)) { res.errors.push(`${where}: mã ${code} bị lặp trong tệp`); continue; }
    seenCodes.add(code);
    const old = existing.get(code);
    if (old && old.classId !== classId && !allowMove) {
      res.errors.push(`${where}: mã ${code} đang thuộc lớp khác`);
      continue;
    }

    // Tài khoản học sinh
    let userId = old?.userId ?? null;
    if (!userId) {
      const uname = studentUsername(code);
      if (users.has(uname)) res.warnings.push(`${where}: tên đăng nhập "${uname}" đã có người dùng, chưa tạo tài khoản học sinh`);
      else { userId = addUser(uname, data.fullName, "STUDENT", null); res.studentAccounts++; }
    }

    // Tài khoản phụ huynh (dùng chung cho anh chị em cùng SĐT trong trường)
    let parentUserId = old?.parentUserId ?? null;
    const phone = normalizePhone(data.parentPhone);
    if (!parentUserId) {
      const candidates = [phone, fallbackParentUsername(code)].filter(Boolean) as string[];
      for (const uname of candidates) {
        const u = users.get(uname);
        if (u && u.role === "PARENT" && u.schoolId === schoolId) { parentUserId = u.id; res.linkedSiblings++; break; }
        if (!u) {
          parentUserId = addUser(uname, data.parentName || `PH ${data.fullName}`, "PARENT", phone);
          res.parentAccounts++;
          break;
        }
      }
      if (!parentUserId) res.warnings.push(`${where}: không tạo được tài khoản phụ huynh (tên đăng nhập đã bị dùng)`);
    }

    const info = {
      fullName: data.fullName,
      dob: data.dob ?? null,
      gender: data.gender ?? null,
      ethnicity: data.ethnicity ?? null,
      address: data.address ?? null,
      parentName: data.parentName ?? null,
      parentRelation: data.parentRelation ?? null,
      parentPhone: phone ?? data.parentPhone ?? null,
      note: data.note ?? null,
    };
    if (old) {
      updates.push(
        db.student.update({
          where: { id: old.id },
          data: { ...(updateInfo ? info : {}), classId, userId, parentUserId },
        }),
      );
      res.updated++;
    } else {
      newStudents.push({ ...info, id: randomUUID(), code, schoolId, classId, userId, parentUserId });
      res.created++;
    }
  }

  await db.$transaction([
    db.user.createMany({ data: newUsers }),
    db.student.createMany({ data: newStudents }),
    ...updates,
  ]);
  return res;
}

/** Đặt lại mật khẩu về mặc định của trường và buộc đổi ở lần đăng nhập tiếp theo. */
export async function resetToDefault(userIds: string[], schoolId: string) {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const passwordHash = await bcrypt.hash(school.defaultPassword, 10);
  return db.user.updateMany({
    where: { id: { in: userIds }, schoolId },
    data: { passwordHash, mustChangePassword: true },
  });
}

export function summarize(r: ProvisionResult) {
  const parts = [
    `Thêm mới ${r.created}, cập nhật ${r.updated} học sinh`,
    `tạo ${r.studentAccounts} tài khoản học sinh, ${r.parentAccounts} tài khoản phụ huynh`,
  ];
  if (r.linkedSiblings) parts.push(`${r.linkedSiblings} học sinh dùng chung tài khoản phụ huynh có sẵn (anh chị em)`);
  return parts.join("; ") + ".";
}
