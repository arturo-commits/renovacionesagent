import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ProgressBar } from "@/components/Progress";
import { ACTION_LABEL, STATUS_LABEL, formatDate, formatDuration, isOverdue, recentActivity, userEnrollments } from "@/lib/learning";

export const metadata = { title: "Mi expediente" };

export default async function Expediente() {
  const user = await requireUser();
  const rows = userEnrollments(user.id);
  const activity = recentActivity(user.id, 100);
  const totalHours = rows.filter((r) => r.status === "completado").reduce((a, r) => a + r.hours, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Mi</span> expediente de formación
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Registro de tus inscripciones, progreso, dedicación y resultados.
          </p>
        </div>
        <a className="btn ghost" href={`/expediente-pdf/${user.id}`} target="_blank">Descargar PDF</a>
        <div className="card stat" style={{ padding: "12px 20px" }}>
          <div className="num" style={{ fontSize: 26 }}>{totalHours} h</div>
          <div className="lbl">Horas certificadas</div>
        </div>
      </div>

      <div className="card">
        <h3>Datos del alumno</h3>
        <div className="grid grid-4 small">
          <div><span className="muted">Nombre</span><br />{user.first_name} {user.last_name}</div>
          <div><span className="muted">NIF/NIE</span><br />{user.nif ?? "—"}</div>
          <div><span className="muted">Empresa</span><br />{user.company ?? "—"}</div>
          <div><span className="muted">Departamento</span><br />{user.department ?? "—"}</div>
        </div>
      </div>

      <div className="card">
        <h3>Cursos</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Curso</th><th>Estado</th><th>Progreso</th><th>Inscripción</th><th>Último acceso</th>
                <th>Fecha límite</th><th>Finalización</th><th className="num">Dedicación</th><th className="num">Nota</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} className="muted">Sin inscripciones.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.enrollment_id}>
                  <td><Link href={`/cursos/${r.course_id}`}>{r.title}</Link><div className="small muted">{r.hours} h</div></td>
                  <td><span className={`badge ${r.status === "completado" ? "ok" : r.status === "inscrito" ? "grey" : ""}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td style={{ minWidth: 120 }}><ProgressBar percent={r.progress.percent} /></td>
                  <td className="nowrap">{formatDate(r.enrolled_at)}</td>
                  <td className="nowrap">{formatDate(r.last_access_at, true)}</td>
                  <td className="nowrap">{isOverdue(r) ? <span className="badge danger">{formatDate(r.due_at)}</span> : formatDate(r.due_at)}</td>
                  <td className="nowrap">{formatDate(r.completed_at)}</td>
                  <td className="num nowrap">{formatDuration(r.time_spent_sec)}</td>
                  <td className="num">{r.final_score ?? "—"}</td>
                  <td>{r.status === "completado" && <Link className="btn sm ghost" href={`/certificado/${r.enrollment_id}`}>Certificado</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Registro de actividad</h3>
        <p className="small muted">Últimos 100 eventos registrados en la plataforma.</p>
        <ul className="timeline">
          {activity.map((a) => (
            <li key={a.id}>
              <time>{formatDate(a.created_at, true)}</time>
              <span>
                {ACTION_LABEL[a.action] ?? a.action}
                {a.course_title ? ` · ${a.course_title}` : ""}
                {a.unit_title ? ` · ${a.unit_title}` : ""}
                {a.detail ? <span className="muted"> · {a.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
