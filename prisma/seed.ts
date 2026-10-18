import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_SUBJECTS } from "../src/lib/constants";

const db = new PrismaClient();
const DEFAULT_PASSWORD = "12345678";

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await db.user.upsert({
    where: { username: "superadmin" },
    update: {},
    create: { username: "superadmin", name: "Quản trị hệ thống", role: "SUPER_ADMIN", passwordHash: await bcrypt.hash("matkhau123", 10) },
  });

  if (await db.school.findUnique({ where: { code: "DEMO" } })) return console.log("Đã có dữ liệu mẫu.");

  const school = await db.school.create({
    data: {
      code: "DEMO", name: "Trường THPT Demo", address: "12 Nguyễn Huệ, Quận 1", authority: "SỞ GD&ĐT TP. HỒ CHÍ MINH",
      principal: "Trần Văn Minh", location: "TP. Hồ Chí Minh", defaultPassword: DEFAULT_PASSWORD,
      subjects: { create: DEFAULT_SUBJECTS.map(([code, name, type], order) => ({ code, name, type, order })) },
    },
  });
  const year = await db.academicYear.create({
    data: { schoolId: school.id, name: "2026-2027", isCurrent: true, semester2Start: new Date(Date.UTC(2027, 0, 15)) },
  });
  const staffHash = await bcrypt.hash("matkhau123", 10);
  await db.user.create({
    data: { schoolId: school.id, username: "admin@demo.edu.vn", email: "admin@demo.edu.vn", name: "Ban giám hiệu", role: "SCHOOL_ADMIN", passwordHash: staffHash },
  });
  const gv = await db.user.create({
    data: { schoolId: school.id, username: "gvcn@demo.edu.vn", email: "gvcn@demo.edu.vn", name: "Nguyễn Thị Lan", phone: "0909111222", role: "TEACHER", passwordHash: staffHash },
  });
  const cls = await db.class.create({ data: { schoolId: school.id, academicYearId: year.id, name: "10A1", grade: 10, homeroomTeacherId: gv.id } });
  const cls2 = await db.class.create({ data: { schoolId: school.id, academicYearId: year.id, name: "12A1", grade: 12 } });

  const names = ["Trần Minh Anh", "Lê Hoàng Bảo", "Phạm Gia Hân", "Võ Đức Huy", "Đặng Khánh Linh", "Bùi Quốc Nam", "Hoàng Thảo Vy", "Ngô Tuấn Kiệt"];
  const subjects = await db.subject.findMany({ where: { schoolId: school.id } });
  for (const [i, fullName] of names.entries()) {
    const code = `79${String(10000001 + i)}`;
    const phone = `0908${String(100000 + i * 1111).slice(0, 6)}`;
    const parentName = `${fullName.split(" ")[0]} Văn ${["An", "Bình", "Cường", "Dũng", "Em", "Phúc", "Giang", "Hải"][i]}`;
    const parent = await db.user.create({
      data: { schoolId: school.id, username: phone, name: parentName, phone, role: "PARENT", passwordHash: hash, mustChangePassword: true },
    });
    const user = await db.user.create({
      data: { schoolId: school.id, username: code, name: fullName, role: "STUDENT", passwordHash: hash, mustChangePassword: true },
    });
    const st = await db.student.create({
      data: {
        schoolId: school.id, classId: cls.id, code, fullName, gender: i % 2 ? "NAM" : "NU", ethnicity: "Kinh",
        dob: new Date(Date.UTC(2011, i, 10 + i)), parentName, parentRelation: "Bố", parentPhone: phone,
        userId: user.id, parentUserId: parent.id,
      },
    });
    // Anh/chị lớp 12 dùng chung tài khoản phụ huynh
    if (i === 0) {
      const sibCode = "7909000001";
      const sib = await db.user.create({
        data: { schoolId: school.id, username: sibCode, name: "Trần Minh Khoa", role: "STUDENT", passwordHash: hash, mustChangePassword: true },
      });
      await db.student.create({
        data: { schoolId: school.id, classId: cls2.id, code: sibCode, fullName: "Trần Minh Khoa", gender: "NAM", parentName, parentRelation: "Bố", parentPhone: phone, userId: sib.id, parentUserId: parent.id },
      });
    }
    // Điểm HK1 mẫu
    const base = 5 + (i % 5);
    for (const sub of subjects) {
      const g = { studentId: st.id, subjectId: sub.id, academicYearId: year.id, semester: 1 };
      if (sub.type === "COMMENT") {
        await db.grade.create({ data: { ...g, kind: "DG", idx: 0, score: 1 } });
        continue;
      }
      const s = (d: number) => Math.min(10, Math.max(0, base + ((d + sub.order + i) % 4) - 1));
      await db.grade.createMany({
        data: [
          { ...g, kind: "TX", idx: 1, score: s(1) }, { ...g, kind: "TX", idx: 2, score: s(2) }, { ...g, kind: "TX", idx: 3, score: s(3) },
          { ...g, kind: "GK", idx: 0, score: s(4) }, { ...g, kind: "CK", idx: 0, score: s(5) },
        ],
      });
    }
  }
  await db.announcement.create({
    data: { classId: cls.id, authorId: gv.id, title: "Họp phụ huynh đầu năm", content: "Kính mời quý phụ huynh dự họp lúc 8h00 Chủ nhật 25/10 tại phòng 10A1." },
  });
  console.log("Đã tạo dữ liệu mẫu.");
}

main().finally(() => db.$disconnect());
