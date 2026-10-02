import { notFound } from "next/navigation";
import { requireUser, type User } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { STATUS_LABEL, formatDate, formatDuration, userEnrollments } from "@/lib/learning";
import { canSeeStudent, userGroups } from "@/lib/students";
import { can } from "@/lib/permissions";
import { PrintButton } from "../../certificado/[id]/PrintButton";

export const metadata = { title: "Expediente de formación" };

export default async function ExpedientePdf({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const id = Number((await params).id);
  if (viewer.id !== id && !(can(viewer, "alumnos.ver") && canSeeStudent(viewer, id))) notFound();
  const u = getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  if (!u) notFound();
  const rows = userEnrollments(id);
  const attempts = getDb()
    .prepare(
      `SELECT c.title AS course, q.score, q.passed, q.submitted_at FROM quiz_attempts q
       JOIN enrollments e ON e.id = q.enrollment_id JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ? ORDER BY q.submitted_at`
    )
    .all(id) as { course: string; score: number; passed: number; submitted_at: string }[];
  const done = rows.filter((r) => r.status === "completado");

  return (
    <div className="doc-page">
      <div className="cert-toolbar no-print" style={{ maxWidth: 900 }}>
        <span />
        <PrintButton />
      </div>
      <div className="doc">
        <div className="logo-word">
          tu<span style={{ color: "var(--accent)" }}>io</span>
          <span className="logo-sub" style={{ marginLeft: 8 }}>Academy</span>
        </div>
        <h1>
          <span className="accent">Expediente</span> de formación
        </h1>
        <p className="muted small">Emitido el {formatDate(new Date().toISOString(), true)}</p>

        <table className="table" style={{ marginTop: 16 }}>
          <tbody>
            <tr><td className="muted">Nombre</td><td><b>{u.first_name} {u.last_name}</b></td><td className="muted">NIF/NIE</td><td>{u.nif ?? "—"}</td></tr>
            <tr><td className="muted">Email</td><td>{u.email}</td><td className="muted">Empresa</td><td>{u.company ?? "—"}</td></tr>
            <tr><td className="muted">Departamento</td><td>{u.department ?? "—"}</td><td className="muted">Puesto</td><td>{u.job_title ?? "—"}</td></tr>
            <tr><td className="muted">Alta</td><td>{formatDate(u.created_at)}</td><td className="muted">Grupos</td><td>{userGroups(id).map((g) => g.name).join(", ") || "—"}</td></tr>
          </tbody>
        </table>

        <div className="kpis" style={{ margin: "20px 0" }}>
          <div className="kpi"><b>{rows.length}</b><span>Cursos</span></div>
          <div className="kpi"><b>{done.length}</b><span>Completados</span></div>
          <div className="kpi"><b>{done.reduce((a, r) => a + r.hours, 0)} h</b><span>Horas certificadas</span></div>
          <div className="kpi"><b>{formatDuration(rows.reduce((a, r) => a + r.time_spent_sec, 0))}</b><span>Dedicación registrada</span></div>
        </div>

        <h3>Cursos</h3>
        <table className="table">
          <thead>
            <tr><th>Curso</th><th className="num">Horas</th><th>Estado</th><th className="num">Progreso</th><th>Inscripción</th><th>Inicio</th><th>Finalización</th><th className="num">Dedicación</th><th className="num">Nota</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="muted">Sin inscripciones.</td></tr>}
            {rows.map((r) => (
              <tr key={r.enrollment_id}>
                <td>{r.title}</td>
                <td className="num">{r.hours}</td>
                <td>{STATUS_LABEL[r.status]}</td>
                <td className="num">{r.progress.percent}%</td>
                <td>{formatDate(r.enrolled_at)}</td>
                <td>{formatDate(r.started_at)}</td>
                <td>{formatDate(r.completed_at)}</td>
                <td className="num">{formatDuration(r.time_spent_sec)}</td>
                <td className="num">{r.final_score ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {attempts.length > 0 && (
          <>
            <h3 style={{ marginTop: 24 }}>Evaluaciones</h3>
            <table className="table">
              <thead><tr><th>Curso</th><th>Fecha</th><th className="num">Nota</th><th>Resultado</th></tr></thead>
              <tbody>
                {attempts.map((a, i) => (
                  <tr key={i}><td>{a.course}</td><td>{formatDate(a.submitted_at, true)}</td><td className="num">{a.score}</td><td>{a.passed ? "Apto" : "No apto"}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="doc-foot">
          Documento generado por Tuio Academy a partir del registro de actividad de la plataforma. La dedicación se mide con la
          unidad abierta y visible en el navegador.
        </div>
      </div>
    </div>
  );
}
