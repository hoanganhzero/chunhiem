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
            <label htmlFor="username">Tên đăng nhập</label>
            <input id="username" name="username" required autoComplete="username" autoCapitalize="none" />
          </div>
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <SubmitButton>Đăng nhập</SubmitButton>
        </ActionForm>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Giáo viên: email · Học sinh: mã học sinh · Phụ huynh: số điện thoại.<br />
          Lần đầu đăng nhập dùng mật khẩu mặc định do nhà trường cung cấp.
        </p>
      </div>
    </div>
  );
}
