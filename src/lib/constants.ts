export const ROLES = {
  SUPER_ADMIN: "Quản trị hệ thống",
  SCHOOL_ADMIN: "Quản trị trường",
  TEACHER: "Giáo viên chủ nhiệm",
} as const;
export type Role = keyof typeof ROLES;

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
