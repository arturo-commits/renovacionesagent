import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireStaff, type User } from "@/lib/auth";
import { ProgressBar } from "@/components/Progress";
import {
  ACTION_LABEL, STATUS_LABEL, formatDate, formatDuration, listCourses, recentActivity, userEnrollments,
} from "@/lib/learning";
import { enrollUser, unenrollUser } from "../../actions";
import { EditUserForm, ResetPasswordForm } from "./forms";
import { ConfirmButton } from "@/components/ConfirmButton";

export const metadata = { title: "Ficha de usuario" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const id = Number((await params).id);
  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as (User & { consent_at: string | null }) | undefined;
  if (!user) notFound();
  const enrollments = userEnrollments(id);
  const enrolledIds = new Set(enrollments.map((e) => e.course_id));
  const available = listCourses().filter((c) => !enrolledIds.has(c.id));
  const isAdmin = staff.role === "admin";

  return (
    <>
      <div className="small muted" style={{ marginBottom: 12 }}>
        <Link href="/admin/usuarios">Usuarios</Link> / {user.first_name} {user.last_name}
      </div>
      <div className="page-head">
        <div>
          <h1>{user.first_name} {user.last_name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {user.email} · Alta {formatDate(user.created_at)} · Último acceso {formatDate(user.last_login_at, true)}
            {user.consent_at ? ` · Consentimiento RGPD ${formatDate(user.consent_at)}` : ""}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>Expediente de formación</h3>
          {available.length > 0 && (
            <form action={enrollUser.bind(null, id)} className="actions">
              <select className="input" name="course_id" style={{ maxWidth: 260 }}>
                {available.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button className="btn sm">Inscribir</button>
            </form>
          )}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Curso</th><th>Estado</th><th>Progreso</th><th>Inscripción</th><th>Último acceso</th><th>Finalización</th><th className="num">Dedicación</th><th className="num">Nota</th><th /></tr>
            </thead>
            <tbody>
              {enrollments.length === 0 && <tr><td colSpan={9} className="muted">Sin inscripciones.</td></tr>}
              {enrollments.map((e) => (
                <tr key={e.enrollment_id}>
                  <td>{e.title}</td>
                  <td><span className={`badge ${e.status === "completado" ? "ok" : e.status === "inscrito" ? "grey" : ""}`}>{STATUS_LABEL[e.status]}</span></td>
                  <td style={{ minWidth: 120 }}><ProgressBar percent={e.progress.percent} /></td>
                  <td className="nowrap">{formatDate(e.enrolled_at)}</td>
                  <td className="nowrap">{formatDate(e.last_access_at, true)}</td>
                  <td className="nowrap">{formatDate(e.completed_at)}</td>
                  <td className="num nowrap">{formatDuration(e.time_spent_sec)}</td>
                  <td className="num">{e.final_score ?? "—"}</td>
                  <td className="actions">
                    {e.status === "completado" && <Link className="btn sm ghost" href={`/certificado/${e.enrollment_id}`}>Certificado</Link>}
                    {isAdmin && (
                      <form action={unenrollUser.bind(null, id, e.course_id)}>
                        <ConfirmButton message="¿Dar de baja del curso? Se perderá el progreso de este usuario en el curso.">Baja</ConfirmButton>
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
        <div className="card">
          <h3>Datos</h3>
          {isAdmin ? (
            <EditUserForm user={user} />
          ) : (
            <table className="table small">
              <tbody>
                <tr><td>NIF/NIE</td><td>{user.nif ?? "—"}</td></tr>
                <tr><td>Empresa</td><td>{user.company ?? "—"}</td></tr>
                <tr><td>Departamento</td><td>{user.department ?? "—"}</td></tr>
                <tr><td>Puesto</td><td>{user.job_title ?? "—"}</td></tr>
                <tr><td>Rol</td><td>{user.role}</td></tr>
              </tbody>
            </table>
          )}
          {isAdmin && (
            <>
              <h3 style={{ marginTop: 24 }}>Restablecer contraseña</h3>
              <ResetPasswordForm userId={id} />
            </>
          )}
        </div>
        <div className="card">
          <h3>Registro de actividad</h3>
          <ul className="timeline">
            {recentActivity(id, 60).map((a) => (
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
