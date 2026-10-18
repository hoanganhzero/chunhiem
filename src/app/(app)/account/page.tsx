import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleLabel } from "@/lib/constants";
import { PasswordInput } from "@/components/PasswordInput";
import { PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { changePassword } from "@/actions/auth";

export default async function AccountPage() {
  const me = await requireUser();
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  return (
    <>
      <PageHeader title="Tài khoản" />
      {user.mustChangePassword && (
        <div className="alert warn">
          <strong>Bạn đang dùng mật khẩu mặc định.</strong> Vui lòng đổi mật khẩu mới để tiếp tục sử dụng hệ thống.
        </div>
      )}
      <div className="card">
        <p style={{ marginTop: 0 }}><strong>{me.name}</strong></p>
        <p className="muted" style={{ marginBottom: 0 }}>
          Tên đăng nhập: <code>{me.username}</code> · {roleLabel(me.role, me.schoolType)}{me.schoolName ? ` · ${me.schoolName}` : ""}
        </p>
      </div>
      <div className="card" style={{ maxWidth: 480 }}>
        <h2>Đổi mật khẩu</h2>
        <ActionForm action={changePassword} resetOnSuccess>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="field"><label>Mật khẩu hiện tại</label><PasswordInput name="current" required autoComplete="current-password" /></div>
            <div className="field"><label>Mật khẩu mới (ít nhất 8 ký tự)</label><PasswordInput name="next" required minLength={8} autoComplete="new-password" /></div>
            <div className="field"><label>Nhập lại mật khẩu mới</label><PasswordInput name="confirm" required minLength={8} autoComplete="new-password" /></div>
          </div>
          <SubmitButton>Đổi mật khẩu</SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
