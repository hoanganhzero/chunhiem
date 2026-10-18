import Link from "next/link";

const TABS = [
  ["students", "Học sinh", ""],
  ["accounts", "Tài khoản", "/accounts"],
  ["attendance", "Điểm danh", "/attendance"],
  ["conduct", "Nề nếp", "/conduct"],
  ["grades", "Sổ điểm", "/grades"],
  ["evaluation", "Rèn luyện", "/evaluation"],
  ["messages", "Liên lạc", "/messages"],
  ["reports", "Báo cáo", "/reports"],
] as const;

type Props = {
  cls: { id: string; name: string; academicYear: { name: string }; homeroomTeacher: { name: string } | null };
  active: (typeof TABS)[number][0];
};



export function ClassHeader({ cls, active }: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lớp {cls.name}</h1>
          <div className="muted">
            Năm học {cls.academicYear.name} · GVCN: {cls.homeroomTeacher?.name ?? "chưa phân công"}
          </div>
        </div>
      </div>
      <div className="tabs">
        {TABS.map(([key, label, path]) => (
          <Link key={key} href={`/classes/${cls.id}${path}`} className={key === active ? "active" : ""}>
            {label}
          </Link>
        ))}
      </div>
    </>
  );
}
