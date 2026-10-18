"use client";

import { useRef } from "react";
import { CheckCheck } from "lucide-react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { saveAttendance } from "@/actions/classroom";

const OPTIONS = [
  ["PRESENT", "Có mặt", "Có mặt"],
  ["LATE", "Đi muộn", "Muộn"],
  ["EXCUSED", "Vắng có phép", "Có phép"],
  ["UNEXCUSED", "Vắng không phép", "K.phép"],
] as const;

type Row = { id: string; name: string; status: string; note: string; month: string };

/** Điểm danh: mặc định "Có mặt", chạm để đổi trạng thái; nút lưu luôn hiển thị ở đáy màn hình. */
export function AttendanceForm({ classId, date, rows }: { classId: string; date: string; rows: Row[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const allPresent = () => {
    ref.current?.querySelectorAll<HTMLInputElement>('input[type="radio"][value="PRESENT"]').forEach((i) => (i.checked = true));
  };
  return (
    <ActionForm action={saveAttendance}>
      <input type="hidden" name="classId" value={classId} />
      <input type="hidden" name="date" value={date} />
      <div className="att-list" ref={ref}>
        {rows.map((r, i) => (
          <div className="att-row" key={r.id}>
            <span className="att-no">{i + 1}</span>
            <span className="att-name">{r.name}</span>
            <div className="seg" role="radiogroup" aria-label={`Điểm danh ${r.name}`}>
              {OPTIONS.map(([v, full, short]) => (
                <label key={v} className={`s-${v}`}>
                  <input type="radio" name={`status_${r.id}`} value={v} defaultChecked={r.status === v} />
                  <span className="full">{full}</span>
                  <span className="short">{short}</span>
                </label>
              ))}
            </div>
            <input className="att-note" name={`note_${r.id}`} defaultValue={r.note} placeholder="Ghi chú / lý do…" />
            <span className="att-month" title="Trong tháng: có phép / không phép / muộn">{r.month}</span>
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="sticky-actions">
          <SubmitButton>Lưu điểm danh</SubmitButton>
          <button type="button" className="secondary" onClick={allPresent}><CheckCheck size={18} /> Tất cả có mặt</button>
          <span className="small muted">{rows.length} học sinh</span>
        </div>
      )}
    </ActionForm>
  );
}
