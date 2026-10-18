import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { changePassword } from "@/actions/auth";

export default async function AccountPage() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  return (
    <>
      <div className="page-head"><h1>Tài khoản</h1></div>
      {user.mustChangePassword && (
        <div className="alert warn">
          <strong>Bạn đang dùng mật khẩu mặc định.</strong> Vui lòng đổi mật khẩu mới để tiếp tục sử dụng hệ thống.
        </div>
      )}
      <div className="card">
        <p style={{ marginTop: 0 }}><strong>{me.name}</strong></p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Tên đăng nhập: <code>{me.username}</code> · {ROLES[me.role]}{me.schoolName ? ` · ${me.schoolName}` : ""}
        </p>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <h2>Đổi mật khẩu</h2>
        <ActionForm action={changePassword} resetOnSuccess>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="field"><label>Mật khẩu hiện tại</label><input name="current" type="password" required autoComplete="current-password" /></div>
            <div className="field"><label>Mật khẩu mới (ít nhất 8 ký tự)</label><input name="next" type="password" required minLength={8} autoComplete="new-password" /></div>
            <div className="field"><label>Nhập lại mật khẩu mới</label><input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></div>
          </div>
          <SubmitButton>Đổi mật khẩu</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
