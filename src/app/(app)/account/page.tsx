import { requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { changePassword } from "@/actions/auth";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <div className="page-head"><h1>Tài khoản</h1></div>
      <div className="card">
        <p><strong>{user.name}</strong> — {user.email}</p>
        <p className="muted">{ROLES[user.role]}{user.schoolName ? ` · ${user.schoolName}` : ""}</p>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <h2>Đổi mật khẩu</h2>
        <ActionForm action={changePassword} resetOnSuccess>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="field"><label>Mật khẩu hiện tại</label><input name="current" type="password" required /></div>
            <div className="field"><label>Mật khẩu mới (≥ 8 ký tự)</label><input name="next" type="password" required minLength={8} /></div>
          </div>
          <SubmitButton>Đổi mật khẩu</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
