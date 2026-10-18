"use client";

// Lỗi máy chủ khi hiển thị trang: báo ngắn gọn, mã lỗi để tra trong Logs của Vercel, lối vào trang chẩn đoán
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: "12vh auto", padding: "0 16px", textAlign: "center" }}>
      <h1 style={{ fontSize: 22 }}>Có lỗi xảy ra</h1>
      <p className="muted">Hệ thống chưa xử lý được yêu cầu. Vui lòng thử lại sau ít phút.</p>
      {error.digest && <p className="small muted">Mã lỗi: {error.digest}</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18 }}>
        <button onClick={() => reset()}>Thử lại</button>
        <a className="btn secondary" href="/setup">Kiểm tra hệ thống</a>
      </div>
    </div>
  );
}
