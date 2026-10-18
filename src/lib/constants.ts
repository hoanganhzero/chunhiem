export const ROLES = {
  SUPER_ADMIN: "Quản trị hệ thống",
  SCHOOL_ADMIN: "Quản trị",
  LEADER: "Ban Giám hiệu",
  ACADEMIC: "Giáo vụ",
  TEACHER: "Giáo viên",
  STUDENT: "Học sinh",
  PARENT: "Phụ huynh",
} as const;
export type Role = keyof typeof ROLES;
export const FAMILY_ROLES: Role[] = ["STUDENT", "PARENT"];
/** Quản lý dữ liệu trường: lớp, học sinh, giáo viên, môn học, mẫu báo cáo */
export const MANAGER_ROLES: Role[] = ["SCHOOL_ADMIN", "ACADEMIC"];
/** Xem toàn trường: thống kê, mọi lớp, báo cáo, thông báo toàn trường */
export const SCHOOL_VIEW_ROLES: Role[] = ["SCHOOL_ADMIN", "ACADEMIC", "LEADER"];
/** Tài khoản cán bộ trong trường */
export const STAFF_ROLES: Role[] = ["SCHOOL_ADMIN", "LEADER", "ACADEMIC", "TEACHER"];

export const SCHOOL_TYPES = {
  THPT: "Trường THPT",
  THCS: "Trường THCS",
  GDNN_GDTX: "Trung tâm GDNN-GDTX",
} as const;
export type SchoolType = keyof typeof SCHOOL_TYPES;

/** Cách gọi trên giao diện theo loại đơn vị (Trường / Trung tâm, Học sinh / Học viên…). */
export function terms(type: string | null | undefined) {
  const center = type === "GDNN_GDTX";
  return {
    unit: center ? "Trung tâm" : "Trường",
    unitLower: center ? "trung tâm" : "trường",
    leadership: center ? "Ban Giám đốc" : "Ban Giám hiệu",
    leadershipShort: center ? "BGĐ" : "BGH",
    head: center ? "Giám đốc" : "Hiệu trưởng",
    learner: center ? "Học viên" : "Học sinh",
    learnerLower: center ? "học viên" : "học sinh",
    learnerShort: center ? "HV" : "HS",
  };
}

export function roleLabel(role: string, schoolType?: string | null) {
  const t = terms(schoolType);
  if (role === "LEADER") return t.leadership;
  if (role === "STUDENT") return t.learner;
  return ROLES[role as Role] ?? role;
}

export const ATTENDANCE = {
  PRESENT: "Có mặt",
  LATE: "Đi muộn",
  EXCUSED: "Vắng có phép",
  UNEXCUSED: "Vắng không phép",
} as const;
export const ATTENDANCE_SHORT = { PRESENT: "Có mặt", LATE: "Muộn", EXCUSED: "Có phép", UNEXCUSED: "Không phép" } as const;
export type AttendanceStatus = keyof typeof ATTENDANCE;

export const CONDUCT_TYPES = {
  PRAISE: "Khen thưởng",
  VIOLATION: "Vi phạm",
} as const;

export const RATINGS = {
  TOT: "Tốt",
  KHA: "Khá",
  DAT: "Đạt",
  CHUA_DAT: "Chưa đạt",
} as const;

export const STUDENT_STATUS = {
  ACTIVE: "Đang học",
  TRANSFERRED: "Chuyển trường",
  DROPPED: "Thôi học",
} as const;

export const GENDERS = { NAM: "Nam", NU: "Nữ" } as const;

export const SUBJECT_TYPES = { SCORE: "Đánh giá bằng điểm", COMMENT: "Đánh giá bằng nhận xét" } as const;

export const RELATIONS = ["Bố", "Mẹ", "Người giám hộ"] as const;

/** Môn học mặc định (cấp THCS / THPT theo CT GDPT 2018). Trường có thể sửa. */
export const DEFAULT_SUBJECTS: [code: string, name: string, type: "SCORE" | "COMMENT"][] = [
  ["TOAN", "Toán", "SCORE"],
  ["VAN", "Ngữ văn", "SCORE"],
  ["ANH", "Tiếng Anh", "SCORE"],
  ["LY", "Vật lí", "SCORE"],
  ["HOA", "Hóa học", "SCORE"],
  ["SINH", "Sinh học", "SCORE"],
  ["SU", "Lịch sử", "SCORE"],
  ["DIA", "Địa lí", "SCORE"],
  ["GDKTPL", "GD kinh tế và pháp luật", "SCORE"],
  ["TIN", "Tin học", "SCORE"],
  ["CN", "Công nghệ", "SCORE"],
  ["GDQP", "GD quốc phòng và an ninh", "SCORE"],
  ["GDTC", "Giáo dục thể chất", "COMMENT"],
  ["HDTN", "HĐ trải nghiệm, hướng nghiệp", "COMMENT"],
  ["GDDP", "Nội dung GD địa phương", "COMMENT"],
];
