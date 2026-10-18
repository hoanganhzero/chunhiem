import { BookMarked, CalendarCheck, FileSpreadsheet, MessageCircle, Smartphone } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PasswordInput } from "@/components/PasswordInput";
import { login } from "@/actions/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const metadata = { title: "Đăng nhập" };

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Triển khai mới, CSDL trống hoặc chưa kết nối được → trang khởi tạo
  const users = await db.user.count().catch(() => 0);
  if (users === 0) redirect("/setup");
  return (
    <div className="auth">
      <section className="auth-hero">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="brand" style={{ padding: 0 }}>
            <div className="brand-logo"><BookMarked size={20} /></div>
            <div>
              <div className="brand-name">Sổ Chủ Nhiệm</div>
              <div className="brand-sub">Trường THPT · Trung tâm GDNN-GDTX</div>
            </div>
          </div>
          <h1>Kết nối nhà trường, giáo viên và gia đình</h1>
          <p>Điểm danh, sổ điểm, nề nếp và liên lạc phụ huynh — trên một ứng dụng, dùng được cả trên điện thoại.</p>
          <div className="auth-feats">
            <div><CalendarCheck /> Điểm danh một chạm, thống kê chuyên cần tức thì</div>
            <div><MessageCircle /> Sổ liên lạc điện tử, thông báo đến từng phụ huynh</div>
            <div><FileSpreadsheet /> Sổ điểm TT22, báo cáo Excel theo mẫu của đơn vị</div>
            <div><Smartphone /> Cài lên màn hình chính như một ứng dụng</div>
          </div>
        </div>
        <div className="small" style={{ color: "rgba(255,255,255,0.55)", position: "relative", zIndex: 1 }}>© Sổ Chủ Nhiệm</div>
      </section>

      <section className="auth-form">
        <div className="inner">
          <h1>Đăng nhập</h1>
          <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>Dùng tài khoản do nhà trường cung cấp</p>
          <ActionForm action={login}>
            <div className="field">
              <label htmlFor="username">Tên đăng nhập</label>
              <input id="username" name="username" required autoComplete="username" autoCapitalize="none" autoCorrect="off"
                spellCheck={false} placeholder="Email, mã học sinh hoặc SĐT" />
            </div>
            <div className="field">
              <label htmlFor="password">Mật khẩu</label>
              <PasswordInput id="password" name="password" required autoComplete="current-password" />
            </div>
            <SubmitButton>Đăng nhập</SubmitButton>
          </ActionForm>
          <div className="auth-roles">
            <div><strong>Giáo viên</strong>Email</div>
            <div><strong>Học sinh</strong>Mã học sinh</div>
            <div><strong>Phụ huynh</strong>Số điện thoại</div>
          </div>
          <p className="small muted" style={{ marginTop: 16 }}>
            Lần đầu đăng nhập dùng mật khẩu mặc định của nhà trường, hệ thống sẽ yêu cầu đổi mật khẩu mới.
            Quên mật khẩu? Liên hệ giáo viên chủ nhiệm hoặc giáo vụ để đặt lại.
          </p>
        </div>
      </section>
    </div>
  );
}
