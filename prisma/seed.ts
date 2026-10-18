import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const hash = (p: string) => bcrypt.hash(p, 10);

  await db.user.upsert({
    where: { email: "superadmin@hethong.vn" },
    update: {},
    create: { email: "superadmin@hethong.vn", name: "Quản trị hệ thống", role: "SUPER_ADMIN", passwordHash: await hash("matkhau123") },
  });

  if (await db.school.findUnique({ where: { code: "DEMO" } })) return console.log("Đã có dữ liệu mẫu.");

  const school = await db.school.create({ data: { code: "DEMO", name: "Trường THPT Demo", address: "TP. Hồ Chí Minh" } });
  const year = await db.academicYear.create({ data: { schoolId: school.id, name: "2026-2027", isCurrent: true } });
  await db.user.create({
    data: { schoolId: school.id, email: "admin@demo.edu.vn", name: "Ban giám hiệu", role: "SCHOOL_ADMIN", passwordHash: await hash("matkhau123") },
  });
  const gv = await db.user.create({
    data: { schoolId: school.id, email: "gvcn@demo.edu.vn", name: "Nguyễn Thị Lan", role: "TEACHER", passwordHash: await hash("matkhau123") },
  });
  const cls = await db.class.create({ data: { schoolId: school.id, academicYearId: year.id, name: "10A1", grade: 10, homeroomTeacherId: gv.id } });
  await db.class.create({ data: { schoolId: school.id, academicYearId: year.id, name: "10A2", grade: 10 } });

  const names = ["Trần Minh Anh", "Lê Hoàng Bảo", "Phạm Gia Hân", "Võ Đức Huy", "Đặng Khánh Linh", "Bùi Quốc Nam", "Hoàng Thảo Vy", "Ngô Tuấn Kiệt"];
  for (const [i, fullName] of names.entries()) {
    await db.student.create({
      data: {
        schoolId: school.id, classId: cls.id, code: `HS${String(i + 1).padStart(4, "0")}`, fullName,
        gender: i % 2 ? "NAM" : "NU", dob: new Date(Date.UTC(2011, i, 10 + i)),
        parentName: `Phụ huynh ${fullName.split(" ").pop()}`, parentPhone: `09${String(10000000 + i * 1234567).slice(0, 8)}`,
      },
    });
  }
  console.log("Đã tạo dữ liệu mẫu.");
}

main().finally(() => db.$disconnect());
