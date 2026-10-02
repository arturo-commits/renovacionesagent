"use client";

import { useActionState } from "react";
import { createUser } from "../actions";

export function NewUserForm({ canSetRole }: { canSetRole: boolean }) {
  const [state, action, pending] = useActionState(createUser, undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      <div className="form-row">
        <div className="field"><label>Nombre *</label><input className="input" name="first_name" required /></div>
        <div className="field"><label>Apellidos *</label><input className="input" name="last_name" required /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Email *</label><input className="input" name="email" type="email" required /></div>
        <div className="field">
          <label>Contraseña inicial *</label>
          <input className="input" name="password" minLength={8} required />
          <span className="hint">Comunícala al usuario; podrá cambiarla en su perfil.</span>
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>Departamento</label><input className="input" name="department" /></div>
        <div className="field"><label>Puesto</label><input className="input" name="job_title" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Empresa</label><input className="input" name="company" defaultValue="Tuio" /></div>
        {canSetRole && (
          <div className="field">
            <label>Rol</label>
            <select className="input" name="role" defaultValue="alumno">
              <option value="alumno">Alumno/a</option>
              <option value="tutor">Tutor/a</option>
              <option value="admin">Administración</option>
            </select>
          </div>
        )}
      </div>
      <div className="actions">
        <button className="btn" disabled={pending}>Crear usuario</button>
        <span className="small muted">Se inscribirá automáticamente en los cursos obligatorios.</span>
      </div>
    </form>
  );
}
