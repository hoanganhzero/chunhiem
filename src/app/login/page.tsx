import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { login } from "@/actions/auth";

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1>Quản lý lớp chủ nhiệm</h1>
        <p className="muted" style={{ marginTop: 0 }}>Đăng nhập để tiếp tục</p>
        <ActionForm action={login}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <SubmitButton>Đăng nhập</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
