"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./ActionForm";
import { commentGoal } from "@/actions/emulation";

/** Phụ huynh / học sinh: cam kết đồng hành (1 chạm) hoặc gửi ý kiến cho một mục tiêu. */
export function GoalRespond({ goalId, committed, parent }: { goalId: string; committed: boolean; parent: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {!committed && (
          <ActionForm action={commentGoal}>
            <input type="hidden" name="goalId" value={goalId} />
            <input type="hidden" name="kind" value="COMMIT" />
            <SubmitButton className="sm">🤝 {parent ? "Cam kết đồng hành" : "Em cam kết"}</SubmitButton>
          </ActionForm>
        )}
        <button type="button" className="secondary sm" onClick={() => setOpen(!open)}>💬 Góp ý / cách gia đình hỗ trợ</button>
      </div>
      {open && (
        <ActionForm action={commentGoal} resetOnSuccess>
          <input type="hidden" name="goalId" value={goalId} />
          <input type="hidden" name="kind" value="COMMENT" />
          <div className="composer" style={{ marginTop: 8 }}>
            <textarea name="content" rows={2} required placeholder={parent ? "vd: Gia đình sẽ đặt báo thức 6h và đưa con đến trường sớm." : "vd: Em sẽ chuẩn bị bài từ tối hôm trước."} />
            <SubmitButton className="sm">Gửi</SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
