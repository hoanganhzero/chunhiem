import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { importSchoolStudents } from "@/actions/school";

export default async function SchoolImportPage() {
  const { schoolId } = await requireSchoolAdmin();
  const [school, year] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId } }),
    db.academicYear.findFirst({ where: { schoolId, isCurrent: true } }),
  ]);
  return (
    <>
      <div className="page-head"><div><h1>Nhập học sinh toàn trường</h1>
        <div className="muted">Một tệp Excel cho tất cả các lớp — tạo lớp, học sinh, tài khoản học sinh và phụ huynh trong một lần</div></div></div>
      {!year && <div className="alert error">Chưa có năm học hiện tại. Vào “Năm học & lớp” để tạo năm học trước.</div>}
      <div className="card">
        <h2>Các bước</h2>
        <ol style={{ marginTop: 0, paddingLeft: 20 }}>
          <li>Tải <a href="/templates/hoc-sinh"><strong>tệp mẫu chuẩn (.xlsx)</strong></a> — có trang hướng dẫn, danh sách chọn Giới tính / Quan hệ.</li>
          <li>Điền hoặc dán dữ liệu (từ CSDL ngành, SMAS, vnEdu…). <strong>Cột Lớp bắt buộc</strong> khi nhập toàn trường.</li>
          <li>Tải tệp lên bên dưới. Lớp chưa có sẽ được tạo trong năm học {year?.name ?? "hiện tại"} (khối lấy theo số đầu tên lớp).</li>
          <li>Hệ thống tạo tài khoản: học sinh = <strong>mã HS</strong>, phụ huynh = <strong>SĐT phụ huynh</strong> (anh chị em cùng SĐT dùng chung),
            mật khẩu ban đầu <code>{school.defaultPassword}</code>. In phiếu tài khoản tại trang từng lớp → “Tài khoản”.</li>
        </ol>
        <p className="small muted">Nhập lại tệp không tạo trùng: học sinh trùng mã được cập nhật thông tin và chuyển sang lớp mới nếu đổi lớp.</p>
        {year && (
          <ActionForm action={importSchoolStudents} className="inline">
            <input type="file" name="file" accept=".xlsx,.csv" required />
            <SubmitButton>Nhập dữ liệu</SubmitButton>
          </ActionForm>
        )}
      </div>
    </>
  );
}
