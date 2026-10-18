"use client";

import { useMemo, useRef, useState } from "react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { recordEmulation } from "@/actions/emulation";

type Student = { id: string; name: string; group: string | null };
type Criterion = { id: string; name: string; category: string; points: number };
const CATS: Record<string, string> = { HOC_TAP: "Học tập", NE_NEP: "Nề nếp", HOAT_DONG: "Phong trào" };

/** Ghi thi đua: chạm chọn bạn (hoặc cả tổ) → chạm chọn tiêu chí → Ghi nhận. */
export function EmulationRecorder({
  classId, students, criteria, today, note,
}: { classId?: string; students: Student[]; criteria: Criterion[]; today: string; note?: string }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [crit, setCrit] = useState<string>("");
  const [q, setQ] = useState("");
  const form = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => [...new Set(students.map((s) => s.group).filter(Boolean))] as string[], [students]);
  const shown = students.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const pickGroup = (g: string) => setPicked(new Set(students.filter((s) => s.group === g).map((s) => s.id)));
  const chosen = criteria.find((c) => c.id === crit);

  return (
    <ActionForm action={recordEmulation} resetOnSuccess>
      {classId && <input type="hidden" name="classId" value={classId} />}
      {[...picked].map((id) => <input key={id} type="hidden" name="sid" value={id} />)}
      <input type="hidden" name="criterionId" value={crit} />

      <div className="rec-step"><span className="rec-no">1</span> Chọn bạn được ghi nhận {picked.size > 0 && <span className="badge">{picked.size} đã chọn</span>}</div>
      <div className="rec-tools">
        {students.length > 8 && <input placeholder="Tìm tên…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 220 }} />}
        {groups.map((g) => <button key={g} type="button" className="secondary sm" onClick={() => pickGroup(g)}>Cả {g}</button>)}
        {picked.size > 0 && <button type="button" className="ghost sm" onClick={() => setPicked(new Set())}>Bỏ chọn</button>}
      </div>
      <div className="pick-grid" ref={form}>
        {shown.map((s) => (
          <button key={s.id} type="button" className={`pick ${picked.has(s.id) ? "on" : ""}`} onClick={() => toggle(s.id)} aria-pressed={picked.has(s.id)}>
            <span className="pick-name">{s.name}</span>
            {s.group && <span className="pick-sub">{s.group}</span>}
          </button>
        ))}
      </div>

      <div className="rec-step"><span className="rec-no">2</span> Chọn tiêu chí</div>
      {Object.entries(CATS).map(([k, label]) => {
        const list = criteria.filter((c) => c.category === k);
        if (!list.length) return null;
        return (
          <div key={k} style={{ marginBottom: 10 }}>
            <div className="small muted" style={{ marginBottom: 6 }}>{label}</div>
            <div className="crit-list">
              {list.map((c) => (
                <button key={c.id} type="button" onClick={() => setCrit(c.id)} aria-pressed={crit === c.id}
                  className={`crit ${c.points > 0 ? "plus" : "minus"} ${crit === c.id ? "on" : ""}`}>
                  <span className="crit-pts">{c.points > 0 ? `+${c.points}` : c.points}</span>{c.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="field"><label>Ghi chú (không bắt buộc)</label><input name="note" placeholder="vd: tiết Toán sáng thứ Hai" /></div>
        <div className="field"><label>Ngày</label><input type="date" name="date" defaultValue={today} max={today} /></div>
      </div>
      <div className="sticky-actions">
        <SubmitButton>Ghi nhận{chosen ? ` ${chosen.points > 0 ? "+" : ""}${chosen.points}` : ""}{picked.size ? ` · ${picked.size} bạn` : ""}</SubmitButton>
        {note && <span className="small muted">{note}</span>}
      </div>
    </ActionForm>
  );
}
