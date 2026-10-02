import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireStaff, type User } from "@/lib/auth";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ProgressBar } from "@/components/Progress";
import {
  ACTION_LABEL, STATUS_LABEL, formatDate, formatDuration, isOverdue, listCourses, recentActivity, userEnrollments,
} from "@/lib/learning";
import { listGroups, pendingInvitation, userGroups, userNotes } from "@/lib/students";
import { enrollUser, unenrollUser } from "../../actions";
import { addNote, addUserToGroup, deleteNote, deleteUser, setDueDate } from "../actions";
import { EditUserForm, InviteBox, ResetPasswordForm } from "./forms";

export const metadata = { title: "Ficha del alumno" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const id = Number((await params).id);
  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as (User & { consent_at: string | null; password_hash: string }) | undefined;
  if (!user) notFound();
  const pending = user.password_hash.startsWith("!");
  const enrollments = userEnrollments(id);
  const enrolledIds = new Set(enrollments.map((e) => e.course_id));
  const available = listCourses().filter((c) => !enrolledIds.has(c.id));
  const groups = userGroups(id);
  const otherGroups = listGroups().filter((g) => !groups.some((m) => m.id === g.id));
  const notes = userNotes(id);
  const invite = pending ? pendingInvitation(id) : undefined;
  const isAdmin = staff.role === "admin";

  const done = enrollments.filter((e) => e.status === "completado");
  const overdue = enrollments.filter(isOverdue);
  const kpis = [
    [enrollments.length, "Cursos"],
    [done.length, "Completados"],
    [`${done.reduce((a, e) => a + e.hours, 0)} h`, "Horas certificadas"],
    [formatDuration(enrollments.reduce((a, e) => a + e.time_spent_sec, 0)), "Dedicación"],
  ] as const;

  return (
    <>
      <div className="small muted" style={{ marginBottom: 12 }}>
        <Link href="/admin/usuarios">Alumnos</Link> / {user.first_name} {user.last_name}
      </div>
      <div className="page-head">
        <div>
          <div className="chips" style={{ marginBottom: 8 }}>
            {!user.active && <span className="badge danger">Desactivado</span>}
            {pending && <span className="badge warn">Cuenta sin activar</span>}
            {overdue.length > 0 && <span className="badge danger">{overdue.length} curso(s) vencido(s)</span>}
            {user.role !== "alumno" && <span className="badge solid">{user.role === "admin" ? "Administración" : "Tutor/a"}</span>}
            {groups.map((g) => <Link key={g.id} href={`/admin/grupos/${g.id}`} className="badge">{g.name}</Link>)}
          </div>
          <h1>{user.first_name} {user.last_name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {user.email}
            {user.department ? ` · ${user.department}` : ""}
            {user.job_title ? ` · ${user.job_title}` : ""} · Alta {formatDate(user.created_at)} · Último acceso {formatDate(user.last_login_at, true)}
          </p>
        </div>
        <div className="actions">
          <a className="btn ghost" href={`/expediente-pdf/${id}`} target="_blank">Expediente PDF</a>
          {isAdmin && id !== staff.id && (
            <form action={deleteUser.bind(null, id)}>
              <ConfirmButton className="btn danger" message="¿Eliminar definitivamente al alumno con todo su expediente? Si solo quieres impedir el acceso, desactívalo.">Eliminar</ConfirmButton>
            </form>
          )}
        </div>
      </div>

      {pending && user.active ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Activación de la cuenta</h3>
          <p className="small muted">
            El alumno todavía no ha creado su contraseña.
            {invite ? ` Último enlace generado el ${formatDate(invite.created_at, true)}, caduca el ${formatDate(invite.expires_at)}.` : " No hay ningún enlace vigente."}
            {" "}Por seguridad los enlaces no se guardan: genera uno nuevo para enviárselo (invalida el anterior).
          </p>
          <InviteBox userId={id} />
        </div>
      ) : null}

      <div className="kpis" style={{ marginBottom: 16 }}>
        {kpis.map(([v, l]) => <div className="kpi" key={l}><b>{v}</b><span>{l}</span></div>)}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Expediente de formación</h3>
          {available.length > 0 && (
            <form action={enrollUser.bind(null, id)} className="inline-form">
              <select className="input" name="course_id">
                {available.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button className="btn sm">Inscribir</button>
            </form>
          )}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Curso</th><th>Estado</th><th>Progreso</th><th>Último acceso</th><th>Fecha límite</th><th className="num">Dedic.</th><th className="num">Nota</th><th /></tr>
            </thead>
            <tbody>
              {enrollments.length === 0 && <tr><td colSpan={8} className="muted">Sin inscripciones.</td></tr>}
              {enrollments.map((e) => (
                <tr key={e.enrollment_id}>
                  <td>
                    {e.title}
                    <div className="small muted">Inscrito el {formatDate(e.enrolled_at)}</div>
                    {e.mandatory ? <span className="badge warn">Obligatorio</span> : null}
                  </td>
                  <td>
                    <span className={`badge ${e.status === "completado" ? "ok" : e.status === "inscrito" ? "grey" : ""}`}>{STATUS_LABEL[e.status]}</span>
                    {e.completed_at && <div className="small muted">{formatDate(e.completed_at)}</div>}
                  </td>
                  <td style={{ minWidth: 110 }}><ProgressBar percent={e.progress.percent} /></td>
                  <td className="nowrap small">{formatDate(e.last_access_at, true)}</td>
                  <td>
                    {e.status === "completado" ? (
                      <span className="muted">{formatDate(e.due_at)}</span>
                    ) : (
                      <form action={setDueDate.bind(null, id, e.course_id)} className="inline-form">
                        <input className="input" type="date" name="due" defaultValue={e.due_at ?? ""} style={{ padding: "4px 6px", fontSize: 12, borderColor: isOverdue(e) ? "var(--danger)" : undefined }} />
                        <button className="btn sm ghost" title="Guardar fecha límite" style={{ padding: "4px 8px" }}>OK</button>
                      </form>
                    )}
                  </td>
                  <td className="num nowrap">{formatDuration(e.time_spent_sec)}</td>
                  <td className="num">{e.final_score ?? "—"}</td>
                  <td className="actions-cell">
                    {e.status === "completado" && <Link className="btn sm ghost" href={`/certificado/${e.enrollment_id}`}>Certificado</Link>}
                    {isAdmin && (
                      <form action={unenrollUser.bind(null, id, e.course_id)}>
                        <ConfirmButton message="¿Dar de baja del curso? Se perderá el progreso de este alumno en el curso.">Baja</ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div>
          <div className="card">
            <h3>Notas internas</h3>
            <p className="small muted">Solo visibles para el equipo de formación.</p>
            <form action={addNote.bind(null, id)} className="form" style={{ marginBottom: 12 }}>
              <textarea className="input" name="body" required placeholder="Ej.: pidió ampliar plazo por baja médica hasta el 15/11." style={{ minHeight: 70, fontFamily: "inherit", fontSize: 14 }} />
              <div><button className="btn sm">Añadir nota</button></div>
            </form>
            {notes.length === 0 ? <p className="small muted">Sin notas.</p> : notes.map((n) => (
              <div className="note" key={n.id}>
                <div className="meta actions" style={{ justifyContent: "space-between" }}>
                  <span>{n.author ?? "—"} · {formatDate(n.created_at, true)}</span>
                  {(n.author_id === staff.id || isAdmin) && (
                    <form action={deleteNote.bind(null, id, n.id)}>
                      <ConfirmButton className="btn sm ghost" message="¿Borrar la nota?">Borrar</ConfirmButton>
                    </form>
                  )}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Datos</h3>
            {isAdmin ? (
              <EditUserForm user={user} />
            ) : (
              <table className="table small">
                <tbody>
                  <tr><td>NIF/NIE</td><td>{user.nif ?? "—"}</td></tr>
                  <tr><td>Teléfono</td><td>{user.phone ?? "—"}</td></tr>
                  <tr><td>Empresa</td><td>{user.company ?? "—"}</td></tr>
                  <tr><td>Departamento</td><td>{user.department ?? "—"}</td></tr>
                  <tr><td>Puesto</td><td>{user.job_title ?? "—"}</td></tr>
                </tbody>
              </table>
            )}
            <p className="small muted" style={{ marginTop: 12 }}>
              {user.consent_at ? `Consentimiento de tratamiento de datos: ${formatDate(user.consent_at, true)}` : "Sin consentimiento registrado (se recoge al activar la cuenta)."}
            </p>
            {isAdmin && !pending && (
              <>
                <h3 style={{ marginTop: 24 }}>Restablecer contraseña</h3>
                <ResetPasswordForm userId={id} />
              </>
            )}
          </div>

          <div className="card">
            <h3>Grupos</h3>
            {groups.length === 0 ? <p className="small muted">No pertenece a ningún grupo.</p> : (
              <ul className="timeline">
                {groups.map((g) => (
                  <li key={g.id} style={{ gridTemplateColumns: "1fr auto" }}>
                    <Link href={`/admin/grupos/${g.id}`}>{g.name}</Link>
                    <span className="small muted">{g.end_date ? `Hasta ${formatDate(g.end_date)}` : ""}</span>
                  </li>
                ))}
              </ul>
            )}
            {otherGroups.length > 0 && (
              <form action={addUserToGroup.bind(null, id)} className="inline-form" style={{ marginTop: 12 }}>
                <select className="input" name="group_id">
                  {otherGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button className="btn sm ghost">Añadir al grupo</button>
              </form>
            )}
          </div>
        </div>
        <div className="card">
          <h3>Registro de actividad</h3>
          <ul className="timeline">
            {recentActivity(id, 80).map((a) => (
              <li key={a.id}>
                <time>{formatDate(a.created_at, true)}</time>
                <span className="small">
                  {ACTION_LABEL[a.action] ?? a.action}
                  {a.course_title ? ` · ${a.course_title}` : ""}
                  {a.unit_title ? ` · ${a.unit_title}` : ""}
                  {a.detail ? <span className="muted"> · {a.detail}</span> : null}
                  {a.ip ? <span className="muted"> · IP {a.ip}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
