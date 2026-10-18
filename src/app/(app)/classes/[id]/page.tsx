import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { GENDERS, STUDENT_STATUS } from "@/lib/constants";
import { fmtDate, vnNameCompare } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { StatCard } from "@/components/ui";
import { StudentFields } from "@/components/StudentFields";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { createStudent, importStudents } from "@/actions/classroom";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const students = await db.student.findMany({
    where: { classId: cls.id },
    orderBy: { status: "asc" },
    include: {
      _count: {
        select: {
          attendances: { where: { status: { in: ["EXCUSED", "UNEXCUSED"] } } },
          conductRecords: { where: { type: "VIOLATION" } },
        },
      },
    },
  });
  students.sort((a, b) => (a.status === "ACTIVE" ? 0 : 1) - (b.status === "ACTIVE" ? 0 : 1) || vnNameCompare(a.fullName, b.fullName));
  const active = students.filter((s) => s.status === "ACTIVE");
  const male = active.filter((s) => s.gender === "NAM").length;

  return (
    <>
      <ClassHeader cls={cls} active="students" />
      <div className="grid stats">
        <StatCard icon="students" value={active.length} label="Sĩ số" />
        <StatCard icon="learner" value={`${male} / ${active.length - male}`} label="Nam / Nữ" />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Danh sách lớp</h2>
          <a className="btn secondary sm" href={`/classes/${cls.id}/reports`}>Xuất Excel</a>
        </div>
        <div className="table-wrap">
          <table className="responsive">
            <thead><tr><th>#</th><th>Họ tên</th><th>Mã</th><th>Ngày sinh</th><th>Giới tính</th><th>Phụ huynh</th><th>Vắng</th><th>Vi phạm</th><th>Tình trạng</th></tr></thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td className="hide-sm">{i + 1}</td>
                  <td className="primary"><Link href={`/students/${s.id}`}><strong>{s.fullName}</strong></Link></td>
                  <td data-label="Mã"><code>{s.code}</code></td>
                  <td data-label="Ngày sinh">{fmtDate(s.dob)}</td>
                  <td data-label="Giới tính">{s.gender ? GENDERS[s.gender as keyof typeof GENDERS] : ""}</td>
                  <td data-label="Phụ huynh">{s.parentName}<div className="small">{s.parentPhone && <a href={`tel:${s.parentPhone}`}>{s.parentPhone}</a>}</div></td>
                  <td data-label="Buổi vắng">{s._count.attendances || "–"}</td>
                  <td data-label="Vi phạm">{s._count.conductRecords ? <span className="badge danger">{s._count.conductRecords}</span> : "–"}</td>
                  <td data-label="Tình trạng">
                    <span className={`badge ${s.status === "ACTIVE" ? "ok" : "gray"}`}>
                      {STUDENT_STATUS[s.status as keyof typeof STUDENT_STATUS]}
                    </span>
                  </td>
                </tr>
              ))}
              {students.length === 0 && <tr><td colSpan={9} className="muted">Lớp chưa có học sinh. Thêm thủ công hoặc nhập từ tệp CSV bên dưới.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Nhập danh sách từ Excel — tạo luôn tài khoản học sinh & phụ huynh</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Tải <a href="/templates/hoc-sinh"><strong>tệp mẫu chuẩn (.xlsx)</strong></a>, điền danh sách (hoặc dán từ CSDL ngành / SMAS / vnEdu), rồi tải lên.
          Tài khoản: học sinh = mã HS, phụ huynh = SĐT phụ huynh, mật khẩu ban đầu = mật khẩu mặc định của trường.
          Nhập lại không tạo trùng — học sinh trùng mã được cập nhật.
        </p>
        <ActionForm action={importStudents} className="inline">
          <input type="hidden" name="classId" value={cls.id} />
          <input type="file" name="file" accept=".xlsx,.csv" required />
          <SubmitButton>Nhập danh sách</SubmitButton>
        </ActionForm>
      </div>

      <div className="card">
        <h2>Thêm một học sinh</h2>
        <ActionForm action={createStudent} resetOnSuccess>
          <input type="hidden" name="classId" value={cls.id} />
          <StudentFields withCode />
          <SubmitButton>Thêm học sinh</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
