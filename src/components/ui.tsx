import Link from "next/link";
import { ChevronLeft, Inbox } from "lucide-react";
import { Icon, type IconName } from "./Icon";
import { RATINGS } from "@/lib/constants";

export function PageHeader({
  title, eyebrow, sub, back, actions,
}: { title: React.ReactNode; eyebrow?: React.ReactNode; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div style={{ minWidth: 0 }}>
        {back && <Link className="crumb" href={back.href}><ChevronLeft size={16} />{back.label}</Link>}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <div className="muted">{sub}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function StatCard({
  icon, value, label, sub, tone, href,
}: { icon: IconName; value: React.ReactNode; label: string; sub?: React.ReactNode; tone?: "ok" | "warn" | "danger"; href?: string }) {
  const body = (
    <div className="card stat">
      <div className={`stat-icon ${tone ?? ""}`}><Icon name={icon} size={22} /></div>
      <div style={{ minWidth: 0 }}>
        <div className="num">{value}</div>
        <div className="label">{label}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{body}</Link> : body;
}

export function Empty({ children, icon }: { children: React.ReactNode; icon?: IconName }) {
  return (
    <div className="empty">
      {icon ? <Icon name={icon} size={40} /> : <Inbox size={40} />}
      <div>{children}</div>
    </div>
  );
}

export function QuickAction({ href, icon, label, sub }: { href: string; icon: IconName; label: string; sub?: string }) {
  return (
    <Link href={href}>
      <span className="q-icon"><Icon name={icon} /></span>
      <span>{label}</span>
      {sub && <span className="q-sub">{sub}</span>}
    </Link>
  );
}

/** Biểu đồ cột một chuỗi (vd. số lượt vắng theo ngày). Di chuột / chạm vào cột để xem giá trị. */
export function BarChart({ data, unit }: { data: { label: string; full: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure style={{ margin: 0 }}>
      <div className="chart-bars" role="img" aria-label={data.map((d) => `${d.full}: ${d.value} ${unit}`).join("; ")}>
        {data.map((d) => (
          <div key={d.full} className="col tip" data-tip={`${d.full}: ${d.value} ${unit}`} tabIndex={0}>
            {d.value > 0 && <span className="val">{d.value}</span>}
            <div className="bar" style={{ height: `${(d.value / max) * 85}%` }} />
          </div>
        ))}
      </div>
      <div className="chart-x" aria-hidden>{data.map((d) => <span key={d.full}>{d.label}</span>)}</div>
    </figure>
  );
}

export type RatingCounts = Record<keyof typeof RATINGS, number>;

export function RatingLegend() {
  return (
    <div className="legend">
      {Object.entries(RATINGS).map(([k, v]) => <span key={k}><i className={`r-${k}`} />{v}</span>)}
    </div>
  );
}

/** Thanh xếp chồng phân bố Tốt / Khá / Đạt / Chưa đạt (luôn đi kèm chú giải + số liệu dạng bảng). */
export function RatingStack({ counts }: { counts: RatingCounts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return <span className="small muted">Chưa đủ dữ liệu</span>;
  return (
    <div className="stack" role="img" aria-label={Object.entries(RATINGS).map(([k, v]) => `${v} ${counts[k as keyof typeof RATINGS]}`).join(", ")}>
      {(Object.keys(RATINGS) as (keyof typeof RATINGS)[]).filter((k) => counts[k]).map((k) => (
        <span key={k} className={`r-${k} tip`} data-tip={`${RATINGS[k]}: ${counts[k]} (${Math.round((counts[k] / total) * 100)}%)`}
          style={{ width: `${(counts[k] / total) * 100}%` }} />
      ))}
    </div>
  );
}
