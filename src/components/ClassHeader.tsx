import Link from "next/link";

type Props = {
  cls: { id: string; name: string; academicYear: { name: string }; homeroomTeacher: { name: string } | null };
  active: "students" | "attendance" | "conduct" | "evaluation";
};

const TABS = [
  ["students", "Danh sách học sinh", ""],
  ["attendance", "Điểm danh", "/attendance"],
  ["conduct", "Nề nếp", "/conduct"],
  ["evaluation", "Đánh giá rèn luyện", "/evaluation"],
] as const;

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
