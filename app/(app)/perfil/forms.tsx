"use client";

import { useActionState } from "react";
import { changePassword, updateProfile } from "../actions";
import type { User } from "@/lib/auth";

export function ProfileForm({ user }: { user: User }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const f = (name: keyof User, label: string) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} defaultValue={(user[name] as string | null) ?? ""} />
    </div>
  );
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      <div className="form-row">
        {f("first_name", "Nombre")}
        {f("last_name", "Apellidos")}
      </div>
      <div className="form-row">
        {f("nif", "NIF / NIE")}
        {f("phone", "Teléfono")}
      </div>
      {f("company", "Empresa")}
      <div className="form-row">
        {f("department", "Departamento")}
        {f("job_title", "Puesto")}
      </div>
      <button className="btn" disabled={pending}>Guardar</button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      <div className="field">
        <label htmlFor="current">Contraseña actual</label>
        <input className="input" id="current" name="current" type="password" required autoComplete="current-password" />
      </div>
      <div className="field">
        <label htmlFor="next">Nueva contraseña</label>
        <input className="input" id="next" name="next" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <button className="btn" disabled={pending}>Cambiar contraseña</button>
    </form>
  );
}
