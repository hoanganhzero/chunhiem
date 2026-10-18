import Link from "next/link";
import { requireStudentAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { StudentFields } from "@/components/StudentFields";
import { StudentRecord } from "@/components/StudentRecord";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { resetFamilyPassword, updateStudent } from "@/actions/classroom";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls, student } = await requireStudentAccess(id);
  const accounts = await db.student.findUniqueOrThrow({
    where: { id },
    select: { user: { select: { username: true, mustChangePassword: true } }, parentUser: { select: { username: true, mustChangePassword: true } } },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small"><Link href={`/classes/${cls.id}`}>← Lớp {cls.name}</Link></div>
          <h1>{student.fullName}</h1>
          <div className="muted">Mã HS: {student.code}</div>
        </div>
        <Link className="btn secondary" href={`/classes/${cls.id}/messages/${student.id}`}>💬 Liên lạc phụ huynh</Link>
      </div>

      <div className="card">
        <h2>Thông tin học sinh</h2>
        <ActionForm action={updateStudent}>
          <input type="hidden" name="id" value={student.id} />
          <StudentFields s={student} withStatus />
          <SubmitButton>Lưu thay đổi</SubmitButton>
        </ActionForm>
      </div>

      <div className="card">
        <h2>Tài khoản</h2>
        <table>
          <tbody>
            {([["student", "Học sinh", accounts.user], ["parent", "Phụ huynh", accounts.parentUser]] as const).map(([which, label, u]) => (
              <tr key={which}>
                <td>{label}</td>
                <td>{u ? <code>{u.username}</code> : <span className="muted">Chưa có — vào tab Tài khoản của lớp để tạo</span>}</td>
                <td>{u && (u.mustChangePassword ? <span className="badge warn">Chưa đổi MK</span> : <span className="badge ok">Đã kích hoạt</span>)}</td>
                <td>
                  {u && (
                    <ActionForm action={resetFamilyPassword} confirm="Đặt lại mật khẩu về mặc định?">
                      <input type="hidden" name="studentId" value={student.id} />
                      <input type="hidden" name="which" value={which} />
                      <SubmitButton className="secondary">Đặt lại mật khẩu</SubmitButton>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StudentRecord studentId={student.id} academicYearId={cls.academicYearId} schoolId={cls.schoolId} />
    </>
  );
}
