"use client";

import { useActionState, useState } from "react";
import type { User } from "@/lib/auth";
import { resetPassword, updateUser } from "../../actions";
import { generateInvite } from "../actions";
import { CopyButton } from "@/components/CopyButton";
import { ROLE_LABEL, type Role } from "@/lib/permissions";

export function EditUserForm({
  user, roles, canDeactivate, departments,
}: { user: User; roles: Role[]; canDeactivate: boolean; departments: string[] }) {
  const [role, setRole] = useState<Role>(user.role);
  const scope = (user.scope_departments ?? "").split("|").filter(Boolean);
  const roleEditable = roles.includes(user.role);
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
      <div className="form-row">{f("nif", "NIF/NIE")}{f("phone", "Teléfono")}</div>
      {f("company", "Empresa")}
      <div className="form-row">{f("department", "Departamento")}{f("job_title", "Puesto")}</div>
      <div className="form-row">
        <div className="field">
          <label>Rol</label>
          {roleEditable ? (
            <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          ) : (
            <input className="input" value={ROLE_LABEL[user.role]} disabled />
          )}
        </div>
        {canDeactivate ? (
          <label className="check" style={{ alignSelf: "end", paddingBottom: 10 }}>
            <input type="checkbox" name="active" defaultChecked={!!user.active} /> Usuario activo
          </label>
        ) : <div />}
      </div>
      {role === "tutor" && departments.length > 0 && (
        <div className="field">
          <label>Ámbito de seguimiento</label>
          <input type="hidden" name="scope" value="" />
          <div className="chips">
            {departments.map((d) => (
              <label key={d} className="check badge grey" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="scope" value={d} defaultChecked={scope.includes(d)} /> {d}
              </label>
            ))}
          </div>
          <span className="hint">Solo verá y seguirá a los alumnos de estos departamentos. Sin marcar ninguno, ve a todos.</span>
        </div>
      )}
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
      {state?.mailed && <div className={`alert ${state.mailed.startsWith("No") ? "error" : "ok"}`}>{state.mailed}</div>}
      {state?.link ? (
        <div className="copy-box">
          <input className="input" readOnly value={state.link} />
          <CopyButton text={state.link} />
        </div>
      ) : null}
      <div>
        <button className="btn sm" disabled={pending}>{state?.link ? "Reenviar / generar otro enlace" : "Enviar invitación de activación"}</button>
      </div>
    </form>
  );
}
