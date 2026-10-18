import { BookMarked } from "lucide-react";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PasswordInput } from "@/components/PasswordInput";
import { setupAdmin } from "@/actions/setup";
import { db } from "@/lib/db";

export const metadata = { title: "Khởi tạo hệ thống" };
export const dynamic = "force-dynamic";

// Chỉ báo tên biến có mặt hay không — không bao giờ hiển thị giá trị
const DB_VARS = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DIRECT_URL"];

export default async function SetupPage() {
  let users: number | null = null;
  let dbError = "";
  try {
    users = await db.user.count();
  } catch (e) {
    dbError = e instanceof Error ? e.message.split("\n").filter(Boolean).slice(-1)[0] ?? "" : String(e);
  }
  if (users) redirect("/login");

  return (
    <div className="auth">
      <section className="auth-form" style={{ flex: 1 }}>
        <div className="inner">
          <div className="brand" style={{ padding: 0, marginBottom: 18 }}>
            <div className="brand-logo"><BookMarked size={20} /></div>
            <div className="brand-name">Sổ Chủ Nhiệm</div>
          </div>
          <h1>Khởi tạo hệ thống</h1>
          {users === null ? (
            <div className="card" style={{ marginTop: 12 }}>
              <p><strong>Chưa kết nối được cơ sở dữ liệu.</strong></p>
              <p className="small muted" style={{ wordBreak: "break-word" }}>{dbError}</p>
              <p className="small">Biến môi trường CSDL:</p>
              <ul className="small">
                {DB_VARS.map((k) => <li key={k}>{k}: {process.env[k] ? "có" : "chưa có"}</li>)}
                <li>AUTH_SECRET: {process.env.AUTH_SECRET ? "có" : "chưa có"}</li>
              </ul>
              <p className="small muted">
                Trên Vercel: Storage → Create Database → Neon → Connect vào project, rồi Redeploy.
                Nếu lỗi là bảng chưa tồn tại, kiểm tra Build Command dùng <code>npm run vercel-build</code>.
              </p>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0, marginBottom: 22 }}>
                Tạo tài khoản Quản trị hệ thống đầu tiên. Trang này tự khoá sau khi tạo xong.
              </p>
              <ActionForm action={setupAdmin}>
                {process.env.SETUP_CODE && (
                  <div className="field">
                    <label htmlFor="code">Mã khởi tạo (SETUP_CODE)</label>
                    <input id="code" name="code" required autoComplete="off" />
                  </div>
                )}
                <div className="field">
                  <label htmlFor="name">Họ tên</label>
                  <input id="name" name="name" placeholder="Quản trị hệ thống" />
                </div>
                <div className="field">
                  <label htmlFor="username">Tên đăng nhập</label>
                  <input id="username" name="username" required autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    defaultValue="superadmin" autoComplete="username" />
                </div>
                <div className="field">
                  <label htmlFor="password">Mật khẩu (tối thiểu 10 ký tự)</label>
                  <PasswordInput id="password" name="password" required autoComplete="new-password" />
                </div>
                <div className="field">
                  <label htmlFor="confirm">Nhập lại mật khẩu</label>
                  <PasswordInput id="confirm" name="confirm" required autoComplete="new-password" />
                </div>
                <SubmitButton>Tạo quản trị và đăng nhập</SubmitButton>
              </ActionForm>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
