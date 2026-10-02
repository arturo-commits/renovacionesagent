"use client";

import { useActionState } from "react";
import { forgotPassword } from "../actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPassword, undefined);
  if (state?.ok) return <div className="alert ok">{state.ok}</div>;
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <button className="btn block" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</button>
    </form>
  );
}
