"use client";

import { useActionState } from "react";
import { updateGroup } from "../actions";

type G = { id: number; name: string; description: string | null; tutor_id: number | null; start_date: string | null; end_date: string | null };

export function GroupForm({ group, tutors }: { group: G; tutors: { id: number; first_name: string; last_name: string }[] }) {
  const [state, action, pending] = useActionState(updateGroup.bind(null, group.id), undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      <div className="field"><label>Nombre</label><input className="input" name="name" defaultValue={group.name} required /></div>
      <div className="field">
        <label>Descripción</label>
        <textarea className="input" name="description" defaultValue={group.description ?? ""} style={{ minHeight: 70, fontFamily: "inherit" }} />
      </div>
      <div className="form-row">
        <div className="field"><label>Inicio</label><input className="input" type="date" name="start_date" defaultValue={group.start_date ?? ""} /></div>
        <div className="field"><label>Fin (fecha límite)</label><input className="input" type="date" name="end_date" defaultValue={group.end_date ?? ""} /></div>
      </div>
      <div className="field">
        <label>Tutor/a</label>
        <select className="input" name="tutor_id" defaultValue={group.tutor_id ?? ""}>
          <option value="">—</option>
          {tutors.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
        </select>
      </div>
      <label className="check"><input type="checkbox" name="apply_due" /> Aplicar la fecha de fin como fecha límite a todas las inscripciones pendientes del grupo</label>
      <div><button className="btn" disabled={pending}>Guardar</button></div>
    </form>
  );
}
