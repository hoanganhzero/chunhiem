"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card">
      <h2>Đã xảy ra lỗi</h2>
      <p className="muted">Không thể xử lý yêu cầu. Vui lòng thử lại; nếu lỗi lặp lại, hãy liên hệ quản trị trường.</p>
      <button onClick={reset}>Thử lại</button>
    </div>
  );
}
