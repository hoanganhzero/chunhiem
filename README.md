# Quản lý lớp chủ nhiệm

Website quản lý học sinh lớp chủ nhiệm. Thiết kế **đa trường (multi-tenant)**: một hệ thống phục vụ nhiều trường, dữ liệu mỗi trường tách biệt.

## Tính năng

Hỗ trợ **Trường THPT / THCS** và **Trung tâm GDNN-GDTX**: chọn loại đơn vị trong Cài đặt, giao diện tự đổi cách gọi
(Trường ↔ Trung tâm, Học sinh ↔ Học viên, Ban Giám hiệu ↔ Ban Giám đốc).

| Vai trò | Trang chủ & chức năng |
|---|---|
| **Quản trị hệ thống** | Tạo / khoá đơn vị (trường, trung tâm), cấp tài khoản quản trị đầu tiên |
| **Quản trị** (đơn vị) | Toàn quyền trong đơn vị: cài đặt, mật khẩu mặc định, cấp mọi vai trò cán bộ |
| **Ban Giám hiệu / Ban Giám đốc** | Tổng quan toàn đơn vị (chuyên cần hôm nay, lớp chưa điểm danh, biểu đồ vắng 14 ngày), **thống kê học tập & rèn luyện** theo khối / lớp, xem mọi lớp, **thông báo toàn đơn vị** |
| **Giáo vụ** | Năm học, lớp, phân công GVCN, nhập học sinh / giáo viên từ Excel, môn học, mẫu báo cáo; "việc cần xử lý" (lớp chưa có GVCN, HS thiếu tài khoản). Chỉ quản lý tài khoản giáo viên — không đặt lại mật khẩu quản trị / BGH |
| **GVCN** | Trang chủ theo lớp: nhắc điểm danh, tin nhắn mới, thao tác nhanh. Điểm danh một chạm, nề nếp, **sổ điểm TT22**, rèn luyện, **liên lạc phụ huynh**, báo cáo Excel |
| **Phụ huynh** | Chuyển nhanh giữa các con; vắng / khen / vi phạm / kết quả học tập kỳ hiện tại; điểm chi tiết; thông báo lớp & đơn vị; nhắn tin, gọi GVCN |
| **Học sinh / Học viên** | Kết quả học tập của mình, thông báo |

### Thi đua & đồng hành cùng phụ huynh
- **Tổ & cán sự lớp**: GVCN chia tổ, cử tổ trưởng (ghi cho tổ mình), lớp trưởng / lớp phó / bí thư (ghi cho cả lớp).
- **Tiêu chí thi đua** cộng / trừ điểm theo 3 nhóm Học tập – Nề nếp – Phong trào; có sẵn 14 tiêu chí, GVCN sửa / thêm / tắt.
- **Cán sự ghi trên điện thoại** (chạm chọn bạn hoặc “Cả tổ” → chạm tiêu chí). Ghi nhận **chờ GVCN duyệt** mới tính điểm; GVCN ghi thì tính ngay.
  Hệ thống chặn ghi cho bạn ngoài phạm vi và tự ghi cho mình.
- **Bảng thi đua tuần**: xếp hạng tổ theo **điểm trung bình mỗi bạn** (công bằng khi sĩ số tổ khác nhau), gương tốt, **tiến bộ nhất**.
  Học sinh / phụ huynh chỉ thấy điểm của mình, bảng tổ và gương tích cực — không công khai cuối bảng.
- **Huy hiệu**: Ngôi sao tuần, Tiến bộ vượt bậc, Chuyên cần, Tích cực xây dựng bài, Việc tốt, Nề nếp tốt.
- **Trang “Thi đua & tiến bộ”** cho phụ huynh / học sinh: ✅ Ưu điểm, 💡 Cần cố gắng, **Chuyển biến** (30 ngày gần nhất so với 30 ngày trước;
  điểm môn HK I → HK II), biểu đồ điểm thi đua 8 tuần, **mục tiêu rèn luyện** GVCN đặt, nhật ký thi đua.
- **Báo cáo định kỳ** gửi phụ huynh tự kèm điểm thi đua, huy hiệu, ưu điểm, điều cần cố gắng và mục tiêu đang thực hiện.

### Thông báo đẩy & phụ huynh đồng hành
- **Thông báo đẩy (Web Push)** tới điện thoại + **hộp thông báo trong ứng dụng** (chuông, đếm tin chưa đọc):
  - Phụ huynh: con **vắng học / đi muộn** (chỉ gửi khi trạng thái thay đổi — lưu lại điểm danh không gửi trùng), **được khen**,
    **bị nhắc nhở**, tin nhắn GVCN, báo cáo định kỳ, mục tiêu mới, thông báo lớp / trường.
  - GVCN: phụ huynh nhắn tin, **xác nhận đã xem báo cáo**, **cam kết đồng hành** / góp ý mục tiêu.
  - Mỗi người tự chọn loại thông báo muốn nhận (Tài khoản → Thông báo), bật / tắt / gửi thử theo từng thiết bị.
  - iPhone: cần “Thêm vào MH chính” rồi mở từ màn hình chính (iOS 16.4+). Thiết bị đã gỡ đăng ký được tự dọn.
  - Thông báo đẩy được gửi **sau khi** trả kết quả cho giáo viên nên không làm chậm thao tác.
- **Tự trừ điểm thi đua theo điểm danh**: vắng không phép −5, đi muộn −2 (GVCN đổi điểm / tắt trong Tiêu chí).
  Sửa điểm danh thì điểm tự điều chỉnh, không trừ hai lần; hai tiêu chí này không xuất hiện ở phần ghi tay.
- **Phụ huynh xác nhận báo cáo tuần** (“✓ Đã xem báo cáo” + phản hồi tuỳ chọn). GVCN thấy cột “Báo cáo tuần: Đã xem / Chưa xem”
  và tổng “x/y phụ huynh đã xác nhận”.
- **Cam kết đồng hành với mục tiêu**: phụ huynh / học sinh bấm “Cam kết” hoặc gửi góp ý cách gia đình hỗ trợ; GVCN thấy ngay tại hồ sơ học sinh.

### Giao diện & ứng dụng điện thoại (PWA)
- Font **Be Vietnam Pro**, bộ icon Lucide, **chế độ tối** tự động theo điện thoại / máy tính.
- Máy tính: thanh menu bên trái theo vai trò. Điện thoại: **thanh điều hướng dưới đáy** như app + menu “Thêm” trượt lên.
- Điểm danh trên điện thoại: mặc định “Có mặt”, chạm 1 lần để đổi; nút **Lưu** luôn nằm ở đáy màn hình; “Tất cả có mặt”.
- Bảng dài tự chuyển thành thẻ trên màn hình nhỏ; sổ điểm có cột họ tên cố định khi cuộn ngang; ô nhập ≥ 16px (iPhone không tự phóng to).
- **Cài như ứng dụng**: Android / máy tính hiện nút “Cài đặt”; iPhone hướng dẫn *Chia sẻ → Thêm vào MH chính*.
  Mở toàn màn hình, có icon riêng, mở nhanh nhờ lưu đệm tài nguyên tĩnh. Mất mạng → trang báo ngoại tuyến.
  Trang có dữ liệu học sinh **không** được lưu trên máy (an toàn cho máy dùng chung).
- PWA cần chạy qua **HTTPS** (Vercel / Railway tự có; VPS cần chứng chỉ SSL).

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

Cần Node.js 20+ và PostgreSQL (có sẵn `docker-compose.yml`).

```bash
npm install
docker compose up -d          # PostgreSQL ở localhost:5432 (hoặc dùng CSDL Neon / Supabase)
cp .env.example .env          # điền AUTH_SECRET: openssl rand -hex 32; khoá VAPID: npx web-push generate-vapid-keys
npm run db:migrate            # tạo bảng
npm run db:seed               # dữ liệu mẫu (chỉ dùng để thử)
npm run dev                   # http://localhost:3000
```

Tài khoản mẫu:

| Tên đăng nhập | Mật khẩu | Vai trò |
|---|---|---|
| `superadmin` | `matkhau123` | Quản trị hệ thống |
| `admin@demo.edu.vn` | `matkhau123` | Quản trị Trường THPT Demo |
| `bgh@demo.edu.vn` | `matkhau123` | Ban Giám hiệu |
| `giaovu@demo.edu.vn` | `matkhau123` | Giáo vụ |
| `gvcn@demo.edu.vn` | `matkhau123` | GVCN lớp 10A1 |
| `giamdoc@gdtx.edu.vn` | `matkhau123` | Ban Giám đốc — Trung tâm GDNN-GDTX Demo |
| `7910000001` | `12345678` (buộc đổi) | Học sinh 10A1 — **tổ trưởng Tổ 1** (ghi thi đua) |
| `0908100000` | `12345678` (buộc đổi) | Phụ huynh (có 2 con: 10A1 và 12A1) |

> Đổi mật khẩu các tài khoản mẫu (hoặc không chạy seed) trước khi đưa lên môi trường thật.

## Triển khai lên Vercel + Neon (miễn phí để bắt đầu)

**1. Tạo CSDL PostgreSQL trên [Neon](https://neon.tech)** (chọn vùng Singapore cho gần Việt Nam)
- Dashboard → **Connect** → bật *Connection pooling* → sao chép chuỗi kết nối → thêm `&pgbouncer=true` vào cuối → đây là **`DATABASE_URL`**.
- Tắt *Connection pooling* → sao chép chuỗi kết nối → đây là **`DIRECT_URL`**.
- Dùng Supabase thay Neon: *Transaction pooler* (cổng 6543) + `?pgbouncer=true` là `DATABASE_URL`; *Session pooler* / *Direct* (cổng 5432) là `DIRECT_URL`.

**2. Tạo khoá** (chạy trên máy có Node.js)
```bash
openssl rand -hex 32                 # → AUTH_SECRET
npx web-push generate-vapid-keys     # → VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```

**3. Tạo dự án trên [Vercel](https://vercel.com)** → *Add New Project* → chọn repo `chunhiem` → mở *Environment Variables*, thêm:

| Biến | Giá trị |
|---|---|
| `DATABASE_URL` | chuỗi pooled ở bước 1 |
| `DIRECT_URL` | chuỗi trực tiếp ở bước 1 (**bắt buộc** — thiếu sẽ báo lỗi *You must provide a nonempty direct URL*) |
| `AUTH_SECRET` | chuỗi ở bước 2 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | khoá ở bước 2 — **giữ nguyên mãi**, đổi khoá thì mọi thiết bị phải bật lại thông báo |
| `VAPID_SUBJECT` | `mailto:email-cua-truong@...` |

Bấm **Deploy**. Vercel tự chạy `npm run vercel-build`: tạo / cập nhật bảng (`prisma migrate deploy`) rồi build. Mỗi lần đẩy code lên `main` sẽ tự triển khai lại.

**4. Tạo tài khoản quản trị hệ thống** (một lần, trên máy của bạn, trỏ vào CSDL Neon)
```bash
DATABASE_URL="<DIRECT_URL>" DIRECT_URL="<DIRECT_URL>" npm run admin:create -- quantri "MatKhau-Manh-Toi-Thieu-10-Ky-Tu"
```
Đăng nhập trang web bằng tài khoản này → **Đơn vị** → tạo trường / trung tâm và tài khoản quản trị của đơn vị.
*Không* chạy `db:seed` trên CSDL thật (dữ liệu mẫu có mật khẩu công khai — script tự từ chối khi `NODE_ENV=production`).

**5. Quy trình đầu năm** của mỗi đơn vị: Cài đặt (loại đơn vị, mật khẩu mặc định) → tạo năm học → nhập giáo viên từ Excel
(kèm lớp chủ nhiệm) → nhập học sinh toàn trường từ Excel → GVCN in phiếu tài khoản phát cho học sinh, phụ huynh.

**Tự vận hành trên máy chủ riêng** (VPS / máy chủ trường): PostgreSQL + `npm ci && npm run db:deploy && npm run build && npm start`,
đặt sau Nginx có HTTPS (bắt buộc cho PWA và thông báo đẩy). Thay đổi cấu trúc bảng về sau: `npm run db:migrate -- --name <tên>` khi phát triển,
`npm run db:deploy` khi triển khai.

## Kiến trúc

- **Next.js 15** (App Router, Server Components, Server Actions) + **Prisma** + **PostgreSQL** (migration trong `prisma/migrations`)
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
- Gửi thêm qua Zalo OA / SMS / email cho phụ huynh không dùng ứng dụng
- Lên lớp đầu năm: chuyển học sinh sang lớp của năm học mới
- Báo cáo tổng hợp toàn trường cho BGH
- Nhật ký thao tác (audit log), đăng nhập Google Workspace của trường
- Tên miền riêng cho từng trường (vd. `thpt-abc.tenmien.vn`)
