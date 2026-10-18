import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <h2>Không tìm thấy</h2>
      <p className="muted">Trang không tồn tại hoặc bạn không có quyền truy cập.</p>
      <Link href="/dashboard">← Về trang tổng quan</Link>
    </div>
  );
}
