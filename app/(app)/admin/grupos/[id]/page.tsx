import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ConfirmButton } from "@/components/ConfirmButton";
import { formatDate, listCourses } from "@/lib/learning";
import { departments, getGroup, groupProgress } from "@/lib/students";
import { addCourseToGroup, addMembers, deleteGroup, removeCourseFromGroup, removeMember } from "../actions";
import { GroupForm } from "./GroupForm";
import { requirePerm } from "@/lib/auth";
import { can, scopeOf } from "@/lib/permissions";

export const metadata = { title: "Grupo" };

export default async function GroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePerm("grupos.ver");
  const manage = can(staff, "grupos.gestionar");
  const id = Number((await params).id);
  const group = getGroup(id);
  if (!group) notFound();
  const { courses, members } = groupProgress(id, scopeOf(staff));
  const otherCourses = listCourses().filter((c) => !courses.some((x) => x.id === c.id));
  const tutors = getDb().prepare("SELECT id, first_name, last_name FROM users WHERE role <> 'alumno' AND active = 1 ORDER BY first_name").all() as {
    id: number; first_name: string; last_name: string;
  }[];
  const candidates = getDb()
    .prepare("SELECT id, first_name, last_name, email FROM users WHERE active = 1 AND id NOT IN (SELECT user_id FROM group_members WHERE group_id = ?) ORDER BY last_name, first_name")
    .all(id) as { id: number; first_name: string; last_name: string; email: string }[];

  const cells = members.flatMap((m) => m.cells).filter((c): c is NonNullable<typeof c> => !!c);
  const completed = cells.filter((c) => c.status === "completado").length;
  const avg = cells.length ? Math.round(cells.reduce((a, c) => a + c.percent, 0) / cells.length) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = cells.filter((c) => c.status !== "completado" && !!c.due_at && c.due_at < today).length;
  const emails = members.filter((m) => m.active).map((m) => m.email);

  return (
    <>
      <div className="small muted" style={{ marginBottom: 12 }}>
        <Link href="/admin/grupos">Grupos</Link> / {group.name}
      </div>
      <div className="page-head">
        <div>
          <h1>{group.name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {formatDate(group.start_date)} – {formatDate(group.end_date)} · {members.length} alumnos · {courses.length} cursos
          </p>
        </div>
        <div className="actions">
          {emails.length > 0 && (
            <a className="btn ghost" href={`mailto:?bcc=${emails.join(",")}&subject=${encodeURIComponent(`Formación · ${group.name}`)}`}>Escribir al grupo</a>
          )}
          <a className="btn ghost" href={`/admin/informes?grupo=${id}`}>Informe</a>
          {manage && <form action={deleteGroup.bind(null, id)}>
            <ConfirmButton className="btn danger" message="¿Eliminar el grupo? Las inscripciones de los alumnos se mantienen.">Eliminar</ConfirmButton>
          </form>}
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><b>{members.length}</b><span>Alumnos</span></div>
        <div className="kpi"><b>{avg}%</b><span>Progreso medio</span></div>
        <div className="kpi"><b>{completed}/{cells.length}</b><span>Cursos completados</span></div>
        <div className="kpi"><b style={{ color: overdue ? "var(--danger)" : undefined }}>{overdue}</b><span>Vencidos</span></div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Seguimiento</h3>
        </div>
        {members.length === 0 || courses.length === 0 ? (
          <p className="muted small">Añade cursos y alumnos para ver el seguimiento.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  {courses.map((c) => <th key={c.id} style={{ whiteSpace: "normal", minWidth: 120 }}>{c.title}</th>)}
                  <th>Último acceso</th><th />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td><Link href={`/admin/usuarios/${m.id}`}>{m.last_name}, {m.first_name}</Link><div className="small muted">{m.department ?? ""}</div></td>
                    {m.cells.map((c, i) => (
                      <td key={i}>
                        {!c ? <span className="muted small">No inscrito</span> : (
                          <span className={`badge ${c.status === "completado" ? "ok" : c.due_at && c.due_at < today ? "danger" : c.status === "inscrito" ? "grey" : ""}`}>
                            {c.status === "completado" ? "Completado" : `${c.percent}%`}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="nowrap small">{formatDate(m.last_login_at, true)}</td>
                    <td>
                      {manage && <form action={removeMember.bind(null, id, m.id)}>
                        <ConfirmButton className="btn sm ghost" message="¿Quitar del grupo? Sus inscripciones se mantienen.">Quitar</ConfirmButton>
                      </form>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {manage && <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div>
          <div className="card">
            <h3>Añadir alumnos</h3>
            <p className="small muted">Se inscribirán en los cursos del grupo con la fecha de fin como fecha límite.</p>
            <form action={addMembers.bind(null, id)} className="form">
              {candidates.length > 0 && (
                <div className="field">
                  <label>Alumnos</label>
                  <select className="input" name="user_id" multiple style={{ minHeight: 140 }}>
                    {candidates.map((u) => <option key={u.id} value={u.id}>{u.last_name}, {u.first_name} · {u.email}</option>)}
                  </select>
                  <span className="hint">Ctrl/Cmd + clic para elegir varios.</span>
                </div>
              )}
              <div className="field">
                <label>…o todo un departamento</label>
                <select className="input" name="department" defaultValue="">
                  <option value="">—</option>
                  {departments().map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label>…o pega emails</label>
                <textarea className="input" name="emails" placeholder="ana@tuio.com, luis@tuio.com" style={{ minHeight: 70 }} />
              </div>
              <div><button className="btn">Añadir al grupo</button></div>
            </form>
          </div>
        </div>
        <div>
          <div className="card">
            <h3>Cursos del grupo</h3>
            {courses.length === 0 && <p className="small muted">Sin cursos.</p>}
            <ul className="timeline">
              {courses.map((c) => (
                <li key={c.id} style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>{c.title}</span>
                  <form action={removeCourseFromGroup.bind(null, id, c.id)}>
                    <ConfirmButton className="btn sm ghost" message="¿Quitar el curso del grupo? Las inscripciones existentes se mantienen.">Quitar</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
            {otherCourses.length > 0 && (
              <form action={addCourseToGroup.bind(null, id)} className="inline-form" style={{ marginTop: 12 }}>
                <select className="input" name="course_id">
                  {otherCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <button className="btn sm">Añadir curso</button>
              </form>
            )}
          </div>
          <div className="card">
            <h3>Datos del grupo</h3>
            <GroupForm group={group} tutors={tutors} />
          </div>
        </div>
      </div>}
    </>
  );
}
