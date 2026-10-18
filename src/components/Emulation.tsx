import Link from "next/link";
import { BADGES } from "@/lib/emulation";
import type { Leaderboard } from "@/lib/emulation";
import type { buildProgress } from "@/lib/progress";
import { EMU_CATEGORIES } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { Empty } from "./ui";

type Progress = Awaited<ReturnType<typeof buildProgress>>;

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Bảng xếp hạng tổ (theo điểm trung bình mỗi thành viên — công bằng khi tổ đông / ít người). */
export function TeamBoard({ board, highlight }: { board: Leaderboard; highlight?: string | null }) {
  if (!board.teams.length) return <Empty icon="students">Lớp chưa chia tổ.</Empty>;
  const max = Math.max(1, ...board.teams.map((t) => Math.abs(t.avg)));
  return (
    <div className="rank-list">
      {board.teams.map((t, i) => (
        <div key={t.id} className={`rank-row ${highlight === t.id ? "me" : ""}`}>
          <span className={`rank-no r${i + 1}`}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="rank-name">{t.name} <span className="small muted">· {t.members} bạn</span></div>
            <div className="rank-bar"><span className={t.avg < 0 ? "neg" : ""} style={{ width: `${(Math.abs(t.avg) / max) * 100}%` }} /></div>
          </div>
          <div className="rank-pts"><strong>{sign(t.avg)}</strong><div className="small muted">TB / bạn · tổng {sign(t.total)}</div></div>
        </div>
      ))}
    </div>
  );
}

/** Gương tốt + tiến bộ nhất (chỉ nêu tích cực, không công khai cuối bảng). */
export function Highlights({ board }: { board: Leaderboard }) {
  return (
    <div className="grid two" style={{ gap: 12 }}>
      <div>
        <h3>🌟 Gương tốt trong tuần</h3>
        {board.stars.length ? board.stars.map((p, i) => (
          <div key={p.id} className="hl-row"><span>{["🥇", "🥈", "🥉"][i]} {p.fullName}</span><strong>{sign(p.points)}</strong></div>
        )) : <p className="small muted">Chưa có.</p>}
      </div>
      <div>
        <h3>🚀 Tiến bộ nhất</h3>
        {board.improved.length ? board.improved.map((p) => (
          <div key={p.id} className="hl-row"><span>{p.fullName}</span><strong className="up">↑ {p.delta}</strong></div>
        )) : <p className="small muted">Chưa có.</p>}
      </div>
    </div>
  );
}

/** Biểu đồ cột hai chiều: điểm thi đua từng tuần (dương = xanh, âm = đỏ, đường giữa = 0). */
export function WeekTrend({ weekly }: { weekly: { start: Date; points: number }[] }) {
  const max = Math.max(1, ...weekly.map((w) => Math.abs(w.points)));
  return (
    <figure style={{ margin: 0 }}>
      <div className="trend" role="img" aria-label={weekly.map((w) => `Tuần ${fmtDate(w.start)}: ${sign(w.points)}`).join("; ")}>
        {weekly.map((w, i) => (
          <div key={i} className="trend-col tip" tabIndex={0} data-tip={`Tuần từ ${fmtDate(w.start)}: ${sign(w.points)} điểm`}>
            <div className="trend-half top">{w.points > 0 && <><span className="trend-val">{sign(w.points)}</span><span className="trend-bar pos" style={{ height: `${(w.points / max) * 80}%` }} /></>}</div>
            <div className="trend-half bottom">{w.points < 0 && <><span className="trend-bar neg" style={{ height: `${(-w.points / max) * 80}%` }} /><span className="trend-val">{w.points}</span></>}</div>
          </div>
        ))}
      </div>
      <div className="chart-x" aria-hidden>
        {weekly.map((w, i) => <span key={i}>{i === weekly.length - 1 ? "Tuần này" : `${w.start.getUTCDate()}/${w.start.getUTCMonth() + 1}`}</span>)}
      </div>
    </figure>
  );
}

/** Ưu điểm — cần cố gắng — chuyển biến — huy hiệu — mục tiêu — nhật ký: phần lõi trang "Tiến bộ". */
export function ProgressView({ p, learner = "con" }: { p: Progress; learner?: string }) {
  return (
    <>
      {p.badges.length > 0 && (
        <div className="card">
          <h2>Huy hiệu</h2>
          <div className="badge-wall">
            {p.badges.map((b) => (
              <div key={b.key} className="medal" title={b.desc}><span className="medal-icon">{b.icon}</span><strong>{b.label}</strong><span className="small muted">{b.desc}</span></div>
            ))}
          </div>
        </div>
      )}

      <div className="grid two">
        <div className="card insight good">
          <h2>✅ Ưu điểm</h2>
          {p.strengths.length ? <ul>{p.strengths.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="muted small">Chưa đủ dữ liệu để nhận xét.</p>}
        </div>
        <div className="card insight warn">
          <h2>💡 Cần cố gắng</h2>
          {p.limits.length ? <ul>{p.limits.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="muted small">Không có điểm cần lưu ý — tiếp tục phát huy!</p>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Chuyển biến</h2><span className="small muted">30 ngày gần nhất so với 30 ngày trước đó</span></div>
        <div className="changes">
          {p.changes.map((c) => {
            const better = c.after === c.before ? null : c.betterWhen === "down" ? c.after < c.before : c.after > c.before;
            return (
              <div key={c.label} className="change">
                <div className="small muted">{c.label}</div>
                <div className="change-val">
                  <span className="muted">{c.before}</span> → <strong>{c.after}</strong>
                  {better === null ? <span className="badge gray">Giữ nguyên</span> : better ? <span className="badge ok">↗ Tốt hơn</span> : <span className="badge warn">↘ Cần chú ý</span>}
                </div>
              </div>
            );
          })}
        </div>
        {p.subjectChanges.length > 0 && (
          <>
            <h3 style={{ marginTop: 16 }}>Điểm trung bình môn: HK I → HK II</h3>
            <div className="changes">
              {p.subjectChanges.map((s) => {
                const d = Math.round((s.after - s.before) * 10) / 10;
                return (
                  <div key={s.name} className="change">
                    <div className="small muted">{s.name}</div>
                    <div className="change-val"><span className="muted">{s.before.toFixed(1)}</span> → <strong>{s.after.toFixed(1)}</strong>
                      {d === 0 ? null : <span className={`badge ${d > 0 ? "ok" : "warn"}`}>{d > 0 ? `↗ +${d}` : `↘ ${d}`}</span>}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <h3 style={{ marginTop: 16 }}>Điểm thi đua 8 tuần</h3>
        <WeekTrend weekly={p.weekly} />
      </div>

      <div className="card">
        <h2>🎯 Mục tiêu rèn luyện</h2>
        {p.goals.length === 0 ? <p className="muted small">GVCN chưa đặt mục tiêu cho {learner}.</p> : (
          <div className="list">
            {p.goals.map((g) => (
              <div key={g.id} className="list-item">
                <div className="li-body">
                  <div className="li-title">{g.title}</div>
                  {g.dueDate && <div className="li-meta">Hạn: {fmtDate(g.dueDate)}</div>}
                </div>
                {g.status === "DONE" ? <span className="badge ok">Đã đạt</span> : g.status === "MISSED" ? <span className="badge warn">Chưa đạt</span> : <span className="badge">Đang thực hiện</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Nhật ký thi đua gần đây</h2>
        {p.timeline.length === 0 ? <Empty icon="evaluation">Chưa có ghi nhận.</Empty> : (
          <div className="list">
            {p.timeline.map((r) => (
              <div key={r.id} className="list-item">
                <span className={`pts-pill ${r.points > 0 ? "plus" : "minus"}`}>{sign(r.points)}</span>
                <div className="li-body">
                  <div className="li-title">{r.label}</div>
                  <div className="li-meta">{fmtDate(r.date)} · {EMU_CATEGORIES[r.category as keyof typeof EMU_CATEGORIES]}{r.note ? ` · ${r.note}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function BadgeLegend() {
  return (
    <div className="small muted" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {Object.values(BADGES).map((b) => <span key={b.label}>{b.icon} {b.label}</span>)}
    </div>
  );
}

export function WeekNav({ start, base, label }: { start: Date; base: string; label: string }) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const prev = new Date(start.getTime() - 7 * 86400000);
  const next = new Date(start.getTime() + 7 * 86400000);
  const isCurrent = next > new Date();
  return (
    <div className="chips" style={{ alignItems: "center" }}>
      <Link className="chip" href={`${base}?tuan=${iso(prev)}`}>← Tuần trước</Link>
      <span className="chip active">Tuần {label}</span>
      {!isCurrent && <Link className="chip" href={`${base}?tuan=${iso(next)}`}>Tuần sau →</Link>}
    </div>
  );
}
