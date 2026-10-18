# Quản lý lớp chủ nhiệm

Website quản lý học sinh lớp chủ nhiệm. Thiết kế **đa trường (multi-tenant)**: một hệ thống phục vụ nhiều trường, dữ liệu mỗi trường tách biệt.

## Tính năng

| Vai trò | Chức năng |
|---|---|
| **Quản trị hệ thống** | Tạo / khoá trường (tự tạo sẵn danh mục môn học CT 2018), cấp tài khoản quản trị trường |
| **Quản trị trường** | Nhập **toàn trường** từ 1 tệp Excel; nhập giáo viên từ Excel; năm học, lớp, phân công GVCN; môn học; mẫu báo cáo riêng; mật khẩu mặc định |
| **GVCN** | Học sinh & tài khoản, in phiếu tài khoản, điểm danh, nề nếp, **sổ điểm TT22**, đánh giá rèn luyện, **liên lạc phụ huynh**, **xuất báo cáo Excel theo mẫu** |
| **Phụ huynh** | Xem điểm, chuyên cần, nề nếp, rèn luyện của (các) con; nhận thông báo; nhắn tin với GVCN |
| **Học sinh** | Xem kết quả học tập của mình, thông báo lớp |

### Nhập học sinh & cấp tài khoản hàng loạt

1. Tải **tệp mẫu chuẩn** (`/templates/hoc-sinh`): có trang hướng dẫn, danh sách chọn Giới tính / Quan hệ, cột SĐT định dạng văn bản.
   Cột: `Lớp | Mã học sinh* | Họ và tên* | Ngày sinh | Giới tính | Dân tộc | Địa chỉ | Họ tên phụ huynh | Quan hệ | SĐT phụ huynh | Ghi chú`.
   Hệ thống nhận cột theo **tên tiêu đề** nên dán được dữ liệu từ CSDL ngành / SMAS / vnEdu.
2. Tải lên ở trang lớp (GVCN) hoặc **Nhập học sinh toàn trường** (quản trị — cột Lớp bắt buộc, lớp chưa có được tạo tự động).
3. Mỗi học sinh được tạo đồng thời:
   - tài khoản **học sinh**: tên đăng nhập = mã HS
   - tài khoản **phụ huynh**: tên đăng nhập = SĐT phụ huynh — anh chị em cùng SĐT dùng **chung một tài khoản**; không có SĐT → `ph` + mã HS
   - mật khẩu = **mật khẩu mặc định của trường** (Cài đặt trường), **bắt buộc đổi ở lần đăng nhập đầu**
4. In **phiếu tài khoản** cả lớp (tab Tài khoản) để phát cho học sinh mang về.

Nhập lại không tạo trùng (trùng mã → cập nhật). Đã thử 600 học sinh + 1.200 tài khoản: < 1 giây.

### Sổ điểm (Thông tư 22)
- Môn tính điểm: tối đa 5 điểm TX, GK, CK. ĐTB môn HK = (ΣTX + 2·GK + 3·CK)/(số TX + 5); cả năm = (HK1 + 2·HK2)/3.
- Môn nhận xét: Đạt / Chưa đạt.
- Bảng tổng hợp + xếp loại kết quả học tập Tốt / Khá / Đạt / Chưa đạt theo Điều 9 TT22.

### Liên lạc phụ huynh
- Thông báo cho cả lớp; sổ liên lạc riêng từng học sinh (GV ↔ phụ huynh), đánh dấu đã đọc, đếm tin mới.
- **Báo cáo định kỳ tự động**: tổng hợp chuyên cần, khen / vi phạm của từng em trong khoảng ngày, gửi cho từng phụ huynh.

### Báo cáo Excel theo mẫu của trường
- 5 mẫu có sẵn: danh sách lớp, tài khoản, chuyên cần – nề nếp, bảng điểm tổng hợp, tổng kết học tập – rèn luyện.
- Trường tự thiết kế mẫu bằng Excel với các mã `{{truong}}`, `{{lop}}`, `{{hoten}}`, `{{diem_TOAN}}`, `{{hoctap}}`…
  (bảng mã đầy đủ ở trang **Mẫu báo cáo**). Dòng chứa mã theo học sinh được nhân lên cho từng em, giữ nguyên định dạng.
- Kỳ báo cáo: HK I, HK II, cả năm hoặc từng tháng.

## Chạy thử trên máy

```bash
npm install
cp .env.example .env          # điền AUTH_SECRET: openssl rand -hex 32
npm run db:push               # tạo CSDL
npm run db:seed               # dữ liệu mẫu
npm run dev                   # http://localhost:3000
```

Tài khoản mẫu:

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| `superadmin` | `matkhau123` | Quản trị hệ thống |
| `admin@demo.edu.vn` | `matkhau123` | Quản trị Trường THPT Demo |
| `gvcn@demo.edu.vn` | `matkhau123` | GVCN lớp 10A1 |
| `7910000001` | `12345678` (buộc đổi) | Học sinh 10A1 |
| `0908100000` | `12345678` (buộc đổi) | Phụ huynh (có 2 con: 10A1 và 12A1) |

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

- Phân công giáo viên bộ môn tự nhập điểm môn mình dạy; nhập điểm từ Excel
- Gửi thông báo qua Zalo OA / SMS / email, thông báo đẩy trên điện thoại
- Lên lớp đầu năm: chuyển học sinh sang lớp của năm học mới
- Báo cáo tổng hợp toàn trường cho BGH
- Nhật ký thao tác (audit log), đăng nhập Google Workspace của trường
- Tên miền riêng cho từng trường (vd. `thpt-abc.tenmien.vn`)
