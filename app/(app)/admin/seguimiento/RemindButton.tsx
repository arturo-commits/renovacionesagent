"use client";

import { useActionState } from "react";
import { remindSection } from "./actions";

export function RemindButton({ section, label }: { section: Parameters<typeof remindSection>[0]; label: string }) {
  const [state, action, pending] = useActionState(remindSection.bind(null, section), undefined);
  return (
    <form action={action} className="actions">
      {state?.ok && <span className="badge ok">{state.ok}</span>}
      {state?.error && <span className="badge danger">{state.error}</span>}
      <button className="btn sm accent" disabled={pending} onClick={(e) => { if (!confirm(`¿${label}?`)) e.preventDefault(); }}>
        {pending ? "Enviando…" : label}
      </button>
    </form>
  );
}
