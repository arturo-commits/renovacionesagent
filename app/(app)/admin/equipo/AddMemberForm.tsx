"use client";

import { useActionState, useState } from "react";
import { ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/lib/permissions";
import { addTeamMember } from "./actions";

export function AddMemberForm({ roles, departments }: { roles: Role[]; departments: string[] }) {
  const [state, action, pending] = useActionState(addTeamMember, undefined);
  const [role, setRole] = useState<Role>(roles.includes("admin") ? "admin" : roles[0]);
  return (
    <form action={action} className="form">
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      {state?.error && <div className="alert error">{state.error}</div>}
      <div className="form-row">
        <div className="field">
          <label>Email *</label>
          <input className="input" name="email" type="email" required placeholder="nombre@tuio.com" />
          <span className="hint">Si ya tiene cuenta, solo se le cambia el rol.</span>
        </div>
        <div className="field">
          <label>Rol *</label>
          <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <span className="hint">{ROLE_DESCRIPTION[role]}</span>
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>Nombre</label><input className="input" name="first_name" placeholder="Solo si es nuevo" /></div>
        <div className="field"><label>Apellidos</label><input className="input" name="last_name" placeholder="Solo si es nuevo" /></div>
      </div>
      <div className="field"><label>Departamento</label><input className="input" name="department" placeholder="Solo si es nuevo" /></div>
      {role === "tutor" && departments.length > 0 && (
        <div className="field">
          <label>Ámbito de seguimiento</label>
          <div className="chips">
            {departments.map((d) => (
              <label key={d} className="check badge grey" style={{ cursor: "pointer" }}>
                <input type="checkbox" name="scope" value={d} /> {d}
              </label>
            ))}
          </div>
          <span className="hint">Sin marcar ninguno, hará el seguimiento de todos los alumnos.</span>
        </div>
      )}
      <div><button className="btn" disabled={pending}>{pending ? "Guardando…" : "Añadir al equipo"}</button></div>
    </form>
  );
}
