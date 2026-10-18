"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import type { ActionResult } from "@/actions/types";

type Props = {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
};

const PendingContext = createContext(false);

/**
 * Form gọi server action và hiển thị kết quả.
 * Tự gửi FormData (thay vì để React tự xử lý) để form KHÔNG bị xoá trắng sau khi gửi —
 * tránh mất dữ liệu đã nhập (vd. bảng điểm) khi máy chủ báo lỗi.
 */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending || (confirm && !window.confirm(confirm))) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {state.error && <div className="alert error" style={{ width: "100%" }}>{state.error}</div>}
      {state.ok && <div className="alert success" style={{ width: "100%" }}>{state.ok}</div>}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const pending = useContext(PendingContext);
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Đang xử lý…" : children}
    </button>
  );
}
