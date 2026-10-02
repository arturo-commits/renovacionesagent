"use client";

import { useActionState } from "react";
import type { User } from "@/lib/auth";
import { resetPassword, updateUser } from "../../actions";
import { generateInvite } from "../actions";
import { CopyButton } from "@/components/CopyButton";

export function EditUserForm({ user }: { user: User }) {
  const [state, action, pending] = useActionState(updateUser.bind(null, user.id), undefined);
  const f = (name: keyof User, label: string) => (
    <div className="field">
      <label>{label}</label>
      <input className="input" name={name} defaultValue={(user[name] as string | null) ?? ""} />
    </div>
  );
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      <div className="form-row">{f("first_name", "Nombre")}{f("last_name", "Apellidos")}</div>
      <div className="form-row">{f("nif", "NIF/NIE")}{f("company", "Empresa")}</div>
      <div className="form-row">{f("department", "Departamento")}{f("job_title", "Puesto")}</div>
      <div className="form-row">
        <div className="field">
          <label>Rol</label>
          <select className="input" name="role" defaultValue={user.role}>
            <option value="alumno">Alumno/a</option>
            <option value="tutor">Tutor/a</option>
            <option value="admin">Administración</option>
          </select>
        </div>
        <label className="check" style={{ alignSelf: "end", paddingBottom: 10 }}>
          <input type="checkbox" name="active" defaultChecked={!!user.active} /> Usuario activo
        </label>
      </div>
      <button className="btn" disabled={pending}>Guardar</button>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState(resetPassword.bind(null, userId), undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      <div className="actions">
        <input className="input" name="password" minLength={8} required placeholder="Nueva contraseña" style={{ maxWidth: 260 }} />
        <button className="btn ghost" disabled={pending}>Restablecer</button>
      </div>
    </form>
  );
}

export function InviteBox({ userId }: { userId: number }) {
  const [state, action, pending] = useActionState(generateInvite.bind(null, userId), undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.link ? (
        <div className="copy-box">
          <input className="input" readOnly value={state.link} />
          <CopyButton text={state.link} />
        </div>
      ) : null}
      <div>
        <button className="btn sm" disabled={pending}>{state?.link ? "Generar otro enlace" : "Generar enlace de activación"}</button>
      </div>
    </form>
  );
}
