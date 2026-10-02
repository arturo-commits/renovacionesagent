"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { bulkUsers } from "./actions";
import { CopyButton } from "@/components/CopyButton";

type Row = {
  id: number; first_name: string; last_name: string; email: string; department: string | null; job_title: string | null;
  role: string; active: number; pending: number; last_login_at: string | null; enrolled: number; completed: number;
  overdue: number; mandatory_pending: number;
};

const ROLE = { alumno: "Alumno/a", tutor: "Tutor/a", admin: "Admin" } as Record<string, string>;

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Madrid" });
}

export function UsersTable({
  rows, isAdmin, selfId, courses, groups, sort, dir, sortHrefs, pager,
}: {
  rows: Row[]; isAdmin: boolean; selfId: number; courses: { id: number; title: string }[]; groups: { id: number; name: string }[];
  sort: string; dir: string; sortHrefs: Record<string, string>; pager: ReactNode;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [action, setAction] = useState("");
  const [state, formAction, pending] = useActionState(bulkUsers, undefined);
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const th = (key: string, label: string, cls = "") => (
    <th className={cls}>
      <a href={sortHrefs[key]} className={sort === key ? "sorted" : ""}>
        {label} {sort === key ? (dir === "asc" ? "↑" : "↓") : ""}
      </a>
    </th>
  );
  const needsCourse = action === "inscribir" || action === "baja";

  return (
    <form action={formAction} className="card" style={{ padding: 0 }}>
      <div className="bulkbar">
        <b>{selected.size} seleccionados</b>
        <select className="input" name="bulk_action" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Acción en bloque…</option>
          <option value="inscribir">Inscribir en curso</option>
          {groups.length > 0 && <option value="grupo">Añadir a grupo</option>}
          <option value="invitar">Generar enlaces de activación</option>
          {isAdmin && <option value="baja">Dar de baja de curso</option>}
          {isAdmin && <option value="activar">Activar</option>}
          {isAdmin && <option value="desactivar">Desactivar</option>}
        </select>
        {needsCourse && (
          <select className="input" name="bulk_course" required>
            <option value="">Curso…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        )}
        {action === "inscribir" && (
          <label className="actions" style={{ gap: 6 }}>
            Fecha límite <input className="input" type="date" name="bulk_due" />
          </label>
        )}
        {action === "grupo" && (
          <select className="input" name="bulk_group" required>
            <option value="">Grupo…</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <button
          className="btn sm"
          disabled={pending || !selected.size || !action}
          onClick={(e) => {
            if ((action === "baja" || action === "desactivar") && !confirm(`¿Aplicar «${action}» a ${selected.size} usuario(s)?`)) e.preventDefault();
          }}
        >
          {pending ? "Aplicando…" : "Aplicar"}
        </button>
        {state?.ok && <span className="badge ok">{state.ok}</span>}
        {state?.error && <span className="badge danger">{state.error}</span>}
      </div>

      {state?.links && state.links.length > 0 && (
        <div className="alert info" style={{ margin: 16 }}>
          <div className="actions" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <b>Enlaces de activación (válidos 14 días)</b>
            <CopyButton text={state.links.map((l) => `${l.name} <${l.email}>: ${l.link}`).join("\n")} label="Copiar todos" />
          </div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {state.links.map((l) => <li key={l.email}>{l.name} · {l.email} · <code>{l.link}</code></li>)}
          </ul>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input type="checkbox" aria-label="Seleccionar todos" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))} />
              </th>
              {th("nombre", "Nombre")}
              {th("email", "Email")}
              {th("departamento", "Departamento")}
              <th>Estado</th>
              {th("cursos", "Cursos", "num")}
              {th("completados", "Compl.", "num")}
              {th("acceso", "Último acceso")}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="muted">No hay alumnos con estos filtros.</td></tr>}
            {rows.map((u) => (
              <tr key={u.id} className={selected.has(u.id) ? "selected" : ""}>
                <td>
                  <input type="checkbox" name="ids" value={u.id} checked={selected.has(u.id)} onChange={() => toggle(u.id)} disabled={u.id === selfId && !u.active} aria-label={`Seleccionar ${u.first_name}`} />
                </td>
                <td className="nowrap">
                  <Link href={`/admin/usuarios/${u.id}`}>{u.last_name}, {u.first_name}</Link>
                  <div className="small muted">{[u.job_title, u.role !== "alumno" ? ROLE[u.role] : null].filter(Boolean).join(" · ") || " "}</div>
                </td>
                <td className="muted">{u.email}</td>
                <td>{u.department ?? "—"}</td>
                <td>
                  <div className="chips">
                    {!u.active && <span className="badge danger">Desactivado</span>}
                    {u.active && u.pending ? <span className="badge warn">Sin activar</span> : null}
                    {u.overdue > 0 && <span className="badge danger">{u.overdue} vencido{u.overdue > 1 ? "s" : ""}</span>}
                    {u.mandatory_pending > 0 && <span className="badge warn">Obligatoria pendiente</span>}
                    {u.active && !u.pending && !u.overdue && !u.mandatory_pending && <span className="badge ok">Al día</span>}
                  </div>
                </td>
                <td className="num">{u.enrolled}</td>
                <td className="num">{u.completed}</td>
                <td className="nowrap">{fmt(u.last_login_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pager}
    </form>
  );
}
