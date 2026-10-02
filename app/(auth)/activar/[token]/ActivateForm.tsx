"use client";

import { useActionState } from "react";
import { activate } from "../../actions";

export function ActivateForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(activate.bind(null, token), undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input className="input" id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        <span className="hint">Mínimo 8 caracteres.</span>
      </div>
      <div className="field">
        <label htmlFor="password2">Repite la contraseña</label>
        <input className="input" id="password2" name="password2" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <label className="check">
        <input type="checkbox" name="consent" required />
        <span>Acepto que Tuio trate mis datos para gestionar mi formación y emitir los certificados correspondientes.</span>
      </label>
      <button className="btn block" disabled={pending}>{pending ? "Activando…" : "Activar mi cuenta"}</button>
    </form>
  );
}
