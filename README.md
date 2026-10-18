# Quản lý lớp chủ nhiệm

Website quản lý học sinh lớp chủ nhiệm. Thiết kế **đa trường (multi-tenant)**: một hệ thống phục vụ nhiều trường, dữ liệu mỗi trường tách biệt.

## Tính năng

| Vai trò | Chức năng |
|---|---|
| **Quản trị hệ thống** | Tạo / khoá trường, cấp tài khoản quản trị trường đầu tiên |
| **Quản trị trường** (BGH, giáo vụ) | Năm học, lớp, tài khoản giáo viên, phân công GVCN, xem mọi lớp trong trường |
| **Giáo viên chủ nhiệm** | Chỉ thấy lớp mình chủ nhiệm: danh sách & hồ sơ học sinh, nhập/xuất CSV, điểm danh hằng ngày, ghi nhận nề nếp (khen thưởng / vi phạm), đánh giá rèn luyện theo học kỳ (Tốt / Khá / Đạt / Chưa đạt) |

## Chạy thử trên máy

```bash
npm install
cp .env.example .env          # điền AUTH_SECRET: openssl rand -hex 32
npm run db:push               # tạo CSDL
npm run db:seed               # dữ liệu mẫu
npm run dev                   # http://localhost:3000
```

Tài khoản mẫu (mật khẩu `matkhau123`):

- `superadmin@hethong.vn` — quản trị hệ thống
- `admin@demo.edu.vn` — quản trị Trường THPT Demo
- `gvcn@demo.edu.vn` — GVCN lớp 10A1

> Đổi mật khẩu các tài khoản mẫu (hoặc không chạy seed) trước khi đưa lên môi trường thật.

## Triển khai cho toàn trường

1. **CSDL PostgreSQL** (Neon, Supabase, hoặc máy chủ trường): trong `prisma/schema.prisma` đổi `provider = "postgresql"`, đặt `DATABASE_URL`.
2. **Hosting**: Vercel / Railway / Render, hoặc VPS chạy `npm run build && npm start` sau Nginx + HTTPS.
3. Biến môi trường: `DATABASE_URL`, `AUTH_SECRET`.
4. Chạy `npx prisma db push` (về sau nên chuyển sang `prisma migrate`) rồi tạo tài khoản quản trị hệ thống.
5. Quy trình đầu năm: quản trị trường tạo năm học → tạo tài khoản GV → tạo lớp & phân công GVCN → GVCN nhập danh sách lớp từ CSV.

## Kiến trúc

- **Next.js 15** (App Router, Server Components, Server Actions) + **Prisma** + SQLite (dev) / PostgreSQL (prod)
- Đăng nhập: JWT ký HS256 trong cookie httpOnly, mật khẩu băm bcrypt
- Phân quyền tập trung ở `src/lib/auth.ts` (`requireClassAccess`, `requireStudentAccess`, `requireSchoolAdmin`): mọi trang và action đều kiểm tra quyền phía server; truy cập lớp/trường khác trả về 404
- Mọi bảng nghiệp vụ gắn `schoolId` → mở rộng sang trường mới chỉ là thêm một bản ghi `School`

```
prisma/schema.prisma        mô hình dữ liệu
src/lib/                    db, phiên đăng nhập, phân quyền, tiện ích
src/actions/                server actions (logic ghi dữ liệu)
src/app/(app)/              các trang sau đăng nhập
```

## Lộ trình mở rộng gợi ý

- Sổ điểm / nhập điểm từ giáo viên bộ môn
- Chia ngày theo học kỳ để thống kê chuyên cần theo HK
- Cổng phụ huynh (xem điểm danh, nề nếp), thông báo Zalo / SMS / email
- Lên lớp đầu năm: chuyển học sinh sang lớp của năm học mới
- Báo cáo toàn trường, xuất Excel theo mẫu của Sở/Phòng GD
- Nhật ký thao tác (audit log), đăng nhập Google Workspace của trường
- Tên miền riêng cho từng trường (vd. `thpt-abc.tenmien.vn`)
