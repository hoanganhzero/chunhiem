import Link from "next/link";
import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { RATINGS, SCHOOL_VIEW_ROLES, terms } from "@/lib/constants";
import { buildReportData } from "@/lib/reports";
import { Empty, PageHeader, RatingLegend, RatingStack, StatCard, type RatingCounts } from "@/components/ui";

// Thống kê toàn trường có thể lâu hơn giới hạn mặc định của máy chủ serverless
export const maxDuration = 60;

export const metadata = { title: "Thống kê học tập" };

const KEYS = Object.keys(RATINGS) as (keyof typeof RATINGS)[];
const blank = (): RatingCounts => ({ TOT: 0, KHA: 0, DAT: 0, CHUA_DAT: 0 });
const keyOf = (label: unknown) => KEYS.find((k) => RATINGS[k] === label);

/** Thống kê kết quả học tập, rèn luyện, chuyên cần toàn trường theo kỳ — cho BGH / BGĐ. */
export default async function StatsPage({ searchParams }: { searchParams: Promise<{ ky?: string }> }) {
  const { user, schoolId } = await requireSchoolAdmin(SCHOOL_VIEW_ROLES);
  const t = terms(user.schoolType);
  const ky = (await searchParams).ky;
  const key = ky === "HK2" || ky === "CN" ? ky : "HK1";
  const year = await db.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  const classes = year ? await db.class.findMany({ where: { academicYearId: year.id }, orderBy: [{ grade: "asc" }, { name: "asc" }] }) : [];
  const reports = await Promise.all(classes.map((c) => buildReportData(c.id, key)));

  const rows = classes.map((c, i) => {
    const r = reports[i].rows;
    const study = blank();
    const conduct = blank();
    for (const x of r) {
      const s = keyOf(x.hoctap); if (s) study[s]++;
      const k = keyOf(x.renluyen); if (k) conduct[k]++;
    }
    const absent = r.reduce((n, x) => n + Number(x.vang ?? 0), 0);
    const unexcused = r.reduce((n, x) => n + Number(x.vang_kp ?? 0), 0);
    const viol = r.reduce((n, x) => n + Number(x.vipham ?? 0), 0);
    return { cls: c, size: r.length, study, conduct, absent, unexcused, viol };
  });
  const sum = (f: (x: (typeof rows)[number]) => RatingCounts) =>
    rows.reduce((acc, x) => { for (const k of KEYS) acc[k] += f(x)[k]; return acc; }, blank());
  const totalStudy = sum((x) => x.study);
  const totalConduct = sum((x) => x.conduct);
  const students = rows.reduce((n, x) => n + x.size, 0);
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "—");
  const ratedStudy = KEYS.reduce((n, k) => n + totalStudy[k], 0);
  const ratedConduct = KEYS.reduce((n, k) => n + totalConduct[k], 0);

  // Gom theo khối
  const grades = [...new Set(classes.map((c) => c.grade))];

  return (
    <>
      <PageHeader
        eyebrow={`${t.leadership} · ${user.schoolName}`}
        title="Thống kê học tập & rèn luyện"
        sub={`Năm học ${year?.name ?? "—"}`}
      />
      <div className="chips">
        {[["HK1", "Học kỳ I"], ["HK2", "Học kỳ II"], ["CN", "Cả năm"]].map(([k, label]) => (
          <Link key={k} href={`?ky=${k}`} className={`chip ${k === key ? "active" : ""}`}>{label}</Link>
        ))}
      </div>
      <div className="grid stats">
        <StatCard icon="learner" value={students.toLocaleString("vi-VN")} label={`${t.learner} · ${classes.length} lớp`} />
        <StatCard icon="grades" tone="ok" value={pct(totalStudy.TOT + totalStudy.KHA, ratedStudy)} label="Học tập Tốt + Khá" sub={`${ratedStudy} ${t.learnerLower} đã xếp loại`} />
        <StatCard icon="evaluation" tone="ok" value={pct(totalConduct.TOT + totalConduct.KHA, ratedConduct)} label="Rèn luyện Tốt + Khá" sub={`${ratedConduct} đã đánh giá`} />
        <StatCard icon="conduct" tone={totalStudy.CHUA_DAT ? "danger" : undefined} value={totalStudy.CHUA_DAT} label="Học tập Chưa đạt" />
      </div>

      {classes.length === 0 ? <div className="card"><Empty>Chưa có lớp trong năm học hiện tại.</Empty></div> : (
        <>
          <div className="card">
            <div className="card-head"><h2>Kết quả học tập theo khối</h2></div>
            <RatingLegend />
            <div className="table-wrap">
              <table>
                <thead><tr><th>Khối</th><th style={{ width: "45%" }}>Phân bố</th>{KEYS.map((k) => <th key={k}>{RATINGS[k]}</th>)}</tr></thead>
                <tbody>
                  {grades.map((g) => {
                    const c = rows.filter((x) => x.cls.grade === g).reduce((acc, x) => { for (const k of KEYS) acc[k] += x.study[k]; return acc; }, blank());
                    return (
                      <tr key={g}>
                        <td><strong>Khối {g}</strong></td>
                        <td><RatingStack counts={c} /></td>
                        {KEYS.map((k) => <td key={k}>{c[k]}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card flush">
            <div className="card-head"><h2>Chi tiết theo lớp</h2><RatingLegend /></div>
            <div className="table-wrap">
              <table className="responsive">
                <thead>
                  <tr><th>Lớp</th><th>Sĩ số</th><th style={{ minWidth: 180 }}>Học tập</th><th style={{ minWidth: 180 }}>Rèn luyện</th><th>Vắng (KP)</th><th>Vi phạm</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.cls.id}>
                      <td className="primary"><strong>Lớp {x.cls.name}</strong></td>
                      <td data-label="Sĩ số">{x.size}</td>
                      <td data-label="Học tập" style={{ minWidth: 160 }}><div style={{ width: "100%" }}><RatingStack counts={x.study} /></div></td>
                      <td data-label="Rèn luyện" style={{ minWidth: 160 }}><div style={{ width: "100%" }}><RatingStack counts={x.conduct} /></div></td>
                      <td data-label="Vắng (KP)">{x.absent} ({x.unexcused})</td>
                      <td data-label="Vi phạm">{x.viol}</td>
                      <td data-label=""><Link href={`/classes/${x.cls.id}/grades/summary?hk=${key === "HK2" ? 2 : key === "CN" ? "CN" : 1}`}>Bảng điểm →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="small muted">
            Kết quả học tập xếp loại theo Thông tư 22, chỉ tính {t.learnerLower} đã có đủ điểm các môn đang nhập trong kỳ.
            Di chuột / chạm vào thanh màu để xem số lượng và tỉ lệ.
          </p>
        </>
      )}
    </>
  );
}
