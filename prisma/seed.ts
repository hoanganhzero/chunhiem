import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_CRITERIA, DEFAULT_SUBJECTS } from "../src/lib/constants";

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
  await db.user.createMany({
    data: [
      { schoolId: school.id, username: "admin@demo.edu.vn", email: "admin@demo.edu.vn", name: "Quản trị hệ thống trường", role: "SCHOOL_ADMIN", passwordHash: staffHash },
      { schoolId: school.id, username: "bgh@demo.edu.vn", email: "bgh@demo.edu.vn", name: "Trần Văn Minh", role: "LEADER", passwordHash: staffHash },
      { schoolId: school.id, username: "giaovu@demo.edu.vn", email: "giaovu@demo.edu.vn", name: "Lê Thị Thu", role: "ACADEMIC", passwordHash: staffHash },
    ],
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
    data: { schoolId: school.id, classId: null, title: "Lịch kiểm tra giữa kỳ I", content: "Kiểm tra giữa kỳ I diễn ra từ 02/11 đến 07/11. Đề nghị phụ huynh nhắc nhở các em ôn tập." },
  });
  await db.announcement.create({
    data: { schoolId: school.id, classId: cls.id, authorId: gv.id, title: "Họp phụ huynh đầu năm", content: "Kính mời quý phụ huynh dự họp lúc 8h00 Chủ nhật 25/10 tại phòng 10A1." },
  });
  // Điểm danh mẫu 10 ngày gần đây cho lớp 10A1
  const sts = await db.student.findMany({ where: { classId: cls.id } });
  const now = new Date();
  for (let d = 1; d <= 10; d++) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d));
    if (date.getUTCDay() === 0) continue;
    await db.attendance.createMany({
      data: sts.map((st, i) => ({
        studentId: st.id, classId: cls.id, date,
        status: (i + d) % 9 === 0 ? "EXCUSED" : (i + d) % 13 === 0 ? "UNEXCUSED" : (i + d) % 7 === 0 ? "LATE" : "PRESENT",
      })),
    });
  }

  // Thi đua mẫu lớp 10A1: 2 tổ, cán sự, tiêu chí, 8 tuần ghi nhận
  const g1 = await db.classGroup.create({ data: { classId: cls.id, name: "Tổ 1", order: 0 } });
  const g2 = await db.classGroup.create({ data: { classId: cls.id, name: "Tổ 2", order: 1 } });
  const members = await db.student.findMany({ where: { classId: cls.id }, orderBy: { code: "asc" } });
  for (const [i, st] of members.entries()) {
    await db.student.update({
      where: { id: st.id },
      data: { groupId: i % 2 ? g2.id : g1.id, classRole: i === 0 ? "TO_TRUONG" : i === 1 ? "LOP_TRUONG" : i === 3 ? "BI_THU" : i === 2 ? "TO_TRUONG" : null },
    });
  }
  await db.emulationCriterion.createMany({
    data: DEFAULT_CRITERIA.map(([name, category, points], order) => ({ classId: cls.id, name, category, points, order })),
  });
  const crit = await db.emulationCriterion.findMany({ where: { classId: cls.id } });
  const byName = (n: string) => crit.find((c) => c.name.startsWith(n))!;
  const rec = (st: (typeof members)[number], c: (typeof crit)[number], date: Date, status = "APPROVED", by: string | null = gv.id) =>
    ({ classId: cls.id, studentId: st.id, criterionId: c.id, label: c.name, category: c.category, points: c.points, date, status, recordedById: by });
  const day = (ago: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ago));
  const data = [];
  for (let ago = 1; ago <= 56; ago++) {
    if (day(ago).getUTCDay() === 0) continue;
    for (const [i, st] of members.entries()) {
      const k = (ago * 7 + i * 3) % 11;
      if (i === 0) {
        // Trần Minh Anh: tháng trước hay đi muộn, không thuộc bài; tháng này tiến bộ rõ
        if (ago > 30 && k < 3) data.push(rec(st, byName(k === 0 ? "Đi học muộn" : "Không thuộc bài"), day(ago)));
        if (ago <= 30 && k < 4) data.push(rec(st, byName(k === 3 ? "Giúp bạn" : "Phát biểu"), day(ago)));
        continue;
      }
      if (k === 0) data.push(rec(st, byName("Phát biểu"), day(ago)));
      if (k === 4 && i % 3 === 0) data.push(rec(st, byName("Điểm kiểm tra 9"), day(ago)));
      if (k === 7 && i % 2 === 1) data.push(rec(st, byName("Nói chuyện riêng"), day(ago)));
      if (k === 9 && i === 5) data.push(rec(st, byName("Không đúng đồng phục"), day(ago)));
      if (ago % 9 === 0 && i === 6) data.push(rec(st, byName("Tham gia phong trào"), day(ago)));
    }
  }
  const leaderUser = members[0].userId;
  data.push(rec(members[2], byName("Phát biểu"), day(0), "PENDING", leaderUser));
  data.push(rec(members[4], byName("Trực nhật tốt"), day(0), "PENDING", leaderUser));
  await db.emulationRecord.createMany({ data });
  await db.goal.createMany({
    data: [
      { studentId: members[0].id, title: "Không đi học muộn trong tháng này", createdById: gv.id, dueDate: day(-12) },
      { studentId: members[0].id, title: "Thuộc bài, làm đủ bài tập trước khi đến lớp", createdById: gv.id, status: "DONE" },
    ],
  });

  // Trung tâm GDNN-GDTX mẫu (giao diện dùng "Học viên", "Ban Giám đốc")
  const center = await db.school.create({
    data: {
      code: "GDTX-DEMO", name: "Trung tâm GDNN-GDTX Demo", type: "GDNN_GDTX", authority: "SỞ GD&ĐT TP. HỒ CHÍ MINH",
      principal: "Phạm Văn Long", location: "TP. Hồ Chí Minh", defaultPassword: DEFAULT_PASSWORD,
      subjects: { create: DEFAULT_SUBJECTS.map(([code, name, type], order) => ({ code, name, type, order })) },
      academicYears: { create: { name: "2026-2027", isCurrent: true, semester2Start: new Date(Date.UTC(2027, 0, 15)) } },
    },
  });
  await db.user.create({
    data: { schoolId: center.id, username: "giamdoc@gdtx.edu.vn", email: "giamdoc@gdtx.edu.vn", name: "Phạm Văn Long", role: "LEADER", passwordHash: staffHash },
  });
  console.log("Đã tạo dữ liệu mẫu.");
}

main().finally(() => db.$disconnect());
