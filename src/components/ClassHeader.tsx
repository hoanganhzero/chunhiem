import Link from "next/link";
import { db } from "@/lib/db";
import { terms } from "@/lib/constants";
import { Icon, type IconName } from "./Icon";
import { PageHeader } from "./ui";

const TABS = [
  ["students", "", "students"],
  ["accounts", "/accounts", "accounts"],
  ["attendance", "/attendance", "attendance"],
  ["conduct", "/conduct", "conduct"],
  ["emulation", "/emulation", "trophy"],
  ["grades", "/grades", "grades"],
  ["evaluation", "/evaluation", "evaluation"],
  ["messages", "/messages", "messages"],
  ["reports", "/reports", "reports"],
] as const;

type Props = {
  cls: { id: string; name: string; schoolId: string; academicYear: { name: string }; homeroomTeacher: { name: string } | null };
  active: (typeof TABS)[number][0];
  actions?: React.ReactNode;
};

export async function ClassHeader({ cls, active, actions }: Props) {
  const school = await db.school.findUnique({ where: { id: cls.schoolId }, select: { type: true } });
  const t = terms(school?.type);
  const labels: Record<string, string> = {
    students: t.learner, accounts: "Tài khoản", attendance: "Điểm danh", conduct: "Nề nếp",
    emulation: "Thi đua", grades: "Sổ điểm", evaluation: "Rèn luyện", messages: "Liên lạc", reports: "Báo cáo",
  };
  return (
    <>
      <PageHeader
        eyebrow={`Năm học ${cls.academicYear.name}`}
        title={`Lớp ${cls.name}`}
        sub={`GVCN: ${cls.homeroomTeacher?.name ?? "chưa phân công"}`}
        actions={actions}
      />
      <nav className="tabs" aria-label="Chức năng lớp">
        {TABS.map(([key, path, icon]) => (
          <Link key={key} href={`/classes/${cls.id}${path}`} className={key === active ? "active" : ""} aria-current={key === active ? "page" : undefined}>
            <Icon name={icon as IconName} size={17} />
            {labels[key]}
          </Link>
        ))}
      </nav>
    </>
  );
}
