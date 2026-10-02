"use client";

import { useActionState } from "react";
import { runRemindersNow, sendTest } from "./actions";

export function TestForm({ defaultTo }: { defaultTo: string }) {
  const [state, action, pending] = useActionState(sendTest, undefined);
  return (
    <form action={action} className="form">
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      {state?.error && <div className="alert error">{state.error}</div>}
      <div className="inline-form">
        <input className="input" name="to" type="email" defaultValue={defaultTo} style={{ flex: 1 }} />
        <button className="btn" disabled={pending}>{pending ? "Enviando…" : "Enviar prueba"}</button>
      </div>
    </form>
  );
}

export function RunReminders() {
  const [state, action, pending] = useActionState(runRemindersNow, undefined);
  return (
    <form action={action} className="actions">
      <button className="btn accent" disabled={pending}>{pending ? "Enviando…" : "Ejecutar recordatorios ahora"}</button>
      {state?.ok && <span className="badge ok">{state.ok}</span>}
      {state?.error && <span className="badge danger">{state.error}</span>}
    </form>
  );
}
