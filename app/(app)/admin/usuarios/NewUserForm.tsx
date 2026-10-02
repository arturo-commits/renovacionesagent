"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { createUser } from "./actions";

export function NewUserForm({ canSetRole, groups }: { canSetRole: boolean; groups: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(createUser, undefined);
  if (state?.created) {
    const c = state.created;
    return (
      <div className="form">
        <div className="alert ok">Alumno creado: <b>{c.name}</b> ({c.email}).</div>
        {c.link && (
          <div className="field">
            <label>Enlace de activación (válido 14 días)</label>
            <div className="copy-box">
              <input className="input" readOnly value={c.link} />
              <CopyButton text={c.link} />
            </div>
            <span className="hint">Envíaselo al alumno para que cree su contraseña.</span>
          </div>
        )}
        <div className="actions">
          <Link className="btn" href={`/admin/usuarios/${c.id}`}>Ver ficha</Link>
          <a className="btn ghost" href="/admin/usuarios?nuevo=1">Crear otro</a>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      <div className="form-row">
        <div className="field"><label>Nombre *</label><input className="input" name="first_name" required /></div>
        <div className="field"><label>Apellidos *</label><input className="input" name="last_name" required /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Email *</label><input className="input" name="email" type="email" required /></div>
        <div className="field"><label>NIF / NIE</label><input className="input" name="nif" placeholder="12345678Z" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Departamento</label><input className="input" name="department" /></div>
        <div className="field"><label>Puesto</label><input className="input" name="job_title" /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Teléfono</label><input className="input" name="phone" type="tel" /></div>
        <div className="field"><label>Empresa</label><input className="input" name="company" defaultValue="Tuio" /></div>
      </div>
      <div className="form-row">
        {groups.length > 0 ? (
          <div className="field">
            <label>Grupo</label>
            <select className="input" name="group_id" defaultValue="">
              <option value="">Sin grupo</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <span className="hint">Se inscribirá en los cursos del grupo.</span>
          </div>
        ) : <div />}
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
      <div className="field">
        <label>Contraseña inicial</label>
        <input className="input" name="password" minLength={8} placeholder="Déjala vacía para enviar un enlace de activación" />
        <span className="hint">Recomendado: déjala vacía. Se generará un enlace para que el alumno cree su propia contraseña.</span>
      </div>
      <div className="actions">
        <button className="btn" disabled={pending}>Crear alumno</button>
        <span className="small muted">Se inscribirá automáticamente en los cursos obligatorios.</span>
      </div>
    </form>
  );
}
