import { headers } from "next/headers";
import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { vnNameCompare } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PrintButton } from "@/components/PrintButton";
import { createMissingAccounts, resetFamilyPassword } from "@/actions/classroom";

export default async function AccountsPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ in?: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const printMode = (await searchParams).in === "1";
  const [school, students] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: cls.schoolId } }),
    db.student.findMany({
      where: { classId: cls.id, status: "ACTIVE" },
      include: {
        user: { select: { username: true, mustChangePassword: true } },
        parentUser: { select: { username: true, mustChangePassword: true, _count: { select: { children: true } } } },
      },
    }),
  ]);
  students.sort((a, b) => vnNameCompare(a.fullName, b.fullName));
  const h = await headers();
  const site = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const missing = students.filter((s) => !s.userId || !s.parentUserId).length;

  if (printMode) {
    return (
      <>
        <div className="page-head no-print">
          <div><h1>Phiếu tài khoản — Lớp {cls.name}</h1><div className="muted">Cắt theo đường viền, phát cho học sinh mang về</div></div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="btn secondary" href="?">← Quay lại</Link>
            <PrintButton />
          </div>
        </div>
        <div className="slips">
          {students.map((s) => (
            <div className="slip" key={s.id}>
              <h3>{school.name}</h3>
              <div className="small">Học sinh: <strong>{s.fullName}</strong> — Lớp {cls.name}</div>
              <table className="small">
                <tbody>
                  <tr><td>Trang đăng nhập:</td><td><strong>{site}</strong></td></tr>
                  <tr><td>TK học sinh:</td><td><strong>{s.user?.username ?? "—"}</strong></td></tr>
                  <tr><td>TK phụ huynh:</td><td><strong>{s.parentUser?.username ?? "—"}</strong></td></tr>
                  <tr><td>Mật khẩu ban đầu:</td><td><strong>{school.defaultPassword}</strong></td></tr>
                </tbody>
              </table>
              <div className="small muted">Đăng nhập lần đầu bắt buộc đổi mật khẩu mới. Giữ kín mật khẩu sau khi đổi.</div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <ClassHeader cls={cls} active="accounts" />
      <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Link className="btn" href="?in=1">🖨 In phiếu tài khoản cả lớp</Link>
        <a className="btn secondary" href={`/classes/${cls.id}/reports/download?builtin=TAI_KHOAN`}>⬇ Danh sách tài khoản (Excel)</a>
        {missing > 0 && (
          <ActionForm action={createMissingAccounts}>
            <input type="hidden" name="classId" value={cls.id} />
            <SubmitButton className="secondary">Tạo tài khoản còn thiếu ({missing})</SubmitButton>
          </ActionForm>
        )}
        <span className="small muted" style={{ marginLeft: "auto" }}>Mật khẩu mặc định: <code>{school.defaultPassword}</code></span>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>Học sinh</th><th>TK học sinh</th><th>TK phụ huynh</th><th>SĐT</th></tr></thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td><Link href={`/students/${s.id}`}><strong>{s.fullName}</strong></Link></td>
                <td>
                  <Account username={s.user?.username} pending={s.user?.mustChangePassword} studentId={s.id} which="student" />
                </td>
                <td>
                  <Account username={s.parentUser?.username} pending={s.parentUser?.mustChangePassword} studentId={s.id} which="parent" />
                  {(s.parentUser?._count.children ?? 0) > 1 && <div className="small muted">Dùng chung cho {s.parentUser!._count.children} con</div>}
                </td>
                <td className="small">{s.parentPhone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Account({ username, pending, studentId, which }: { username?: string; pending?: boolean; studentId: string; which: string }) {
  if (!username) return <span className="muted">Chưa có</span>;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <code>{username}</code>
      {pending ? <span className="badge warn">Chưa đổi MK</span> : <span className="badge ok">Đã kích hoạt</span>}
      <ActionForm action={resetFamilyPassword} confirm="Đặt lại mật khẩu về mặc định?">
        <input type="hidden" name="studentId" value={studentId} />
        <input type="hidden" name="which" value={which} />
        <SubmitButton className="secondary">Đặt lại MK</SubmitButton>
      </ActionForm>
    </div>
  );
}
