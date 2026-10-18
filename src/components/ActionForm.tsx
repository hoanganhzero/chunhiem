"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/actions/types";

type Props = {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
};

export function ActionForm({ action, children, className, resetOnSuccess, confirm }: Props) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {state.error && <div className="alert error" style={{ width: "100%" }}>{state.error}</div>}
      {state.ok && <div className="alert success" style={{ width: "100%" }}>{state.ok}</div>}
      {children}
    </form>
  );
}

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Đang xử lý…" : children}
    </button>
  );
}
