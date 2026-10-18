import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { GENDERS, STUDENT_STATUS } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { StudentFields } from "@/components/StudentFields";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { createStudent, importStudents } from "@/actions/classroom";

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const students = await db.student.findMany({
    where: { classId: cls.id },
    orderBy: [{ status: "asc" }, { fullName: "asc" }],
    include: {
      _count: {
        select: {
          attendances: { where: { status: { in: ["EXCUSED", "UNEXCUSED"] } } },
          conductRecords: { where: { type: "VIOLATION" } },
        },
      },
    },
  });
  const active = students.filter((s) => s.status === "ACTIVE");
  const male = active.filter((s) => s.gender === "NAM").length;

  return (
    <>
      <ClassHeader cls={cls} active="students" />
      <div className="grid stats">
        <div className="card stat"><div className="num">{active.length}</div><div className="label">Sĩ số</div></div>
        <div className="card stat"><div className="num">{male} / {active.length - male}</div><div className="label">Nam / Nữ</div></div>
      </div>

      <div className="card">
        <div className="page-head" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Danh sách học sinh</h2>
          <a className="btn secondary" href={`/classes/${cls.id}/export`}>Xuất CSV</a>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Mã HS</th><th>Họ tên</th><th>Ngày sinh</th><th>Giới tính</th><th>Phụ huynh</th><th>Số buổi vắng</th><th>Vi phạm</th><th>Tình trạng</th></tr></thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td><code>{s.code}</code></td>
                  <td><Link href={`/students/${s.id}`}><strong>{s.fullName}</strong></Link></td>
                  <td>{fmtDate(s.dob)}</td>
                  <td>{s.gender ? GENDERS[s.gender as keyof typeof GENDERS] : ""}</td>
                  <td>{s.parentName}<div className="small muted">{s.parentPhone}</div></td>
                  <td>{s._count.attendances || ""}</td>
                  <td>{s._count.conductRecords ? <span className="badge danger">{s._count.conductRecords}</span> : ""}</td>
                  <td>
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
        <h2>Thêm học sinh</h2>
        <ActionForm action={createStudent} resetOnSuccess>
          <input type="hidden" name="classId" value={cls.id} />
          <StudentFields withCode />
          <SubmitButton>Thêm học sinh</SubmitButton>
        </ActionForm>
      </div>

      <div className="card">
        <h2>Nhập danh sách từ CSV / Excel</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Lưu file Excel dưới dạng <strong>CSV UTF-8</strong>. Dòng đầu là tiêu đề, thứ tự cột:
          Mã HS, Họ tên, Ngày sinh (dd/mm/yyyy), Giới tính (Nam/Nữ), Địa chỉ, Họ tên phụ huynh, SĐT phụ huynh.
          Học sinh trùng mã sẽ được cập nhật.
        </p>
        <ActionForm action={importStudents} className="inline">
          <input type="hidden" name="classId" value={cls.id} />
          <input type="file" name="file" accept=".csv,text/csv" required />
          <SubmitButton>Nhập dữ liệu</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
