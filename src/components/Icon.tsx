import {
  BarChart3, BookOpen, Building2, CalendarCheck, ClipboardList, FileSpreadsheet, GraduationCap, Home, KeyRound,
  LayoutDashboard, LibraryBig, Megaphone, MessageCircle, MoreHorizontal, School, Settings, ShieldAlert, Star,
  Upload, UserCog, Users, type LucideProps,
} from "lucide-react";

/** Danh mục biểu tượng dùng trong menu (tên dạng chuỗi để truyền từ server sang client). */
export const ICONS = {
  home: Home, dashboard: LayoutDashboard, stats: BarChart3, school: School, building: Building2,
  attendance: CalendarCheck, conduct: ShieldAlert, grades: BookOpen, evaluation: Star, messages: MessageCircle,
  reports: FileSpreadsheet, students: Users, accounts: KeyRound, announce: Megaphone, upload: Upload,
  teachers: UserCog, subjects: LibraryBig, settings: Settings, more: MoreHorizontal, learner: GraduationCap,
  tasks: ClipboardList,
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const C = ICONS[name];
  return <C size={20} strokeWidth={1.9} aria-hidden {...props} />;
}
