import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Icon, UNIT_ICON } from "@/components/Icon";
import { ProgressBar, ProgressRing } from "@/components/Progress";
import {
  ACTION_LABEL, PRODUCT_ILLUSTRATION, PRODUCT_LABEL, STATUS_LABEL, UNIT_TYPE_LABEL,
  formatDate, formatDuration, getCourse, getCourseTree, getEnrollment, nextUnit, progressFor, recentActivity, unitStatuses,
} from "@/lib/learning";
import { enrollSelf } from "../../actions";

type Tab = "contenido" | "progreso" | "calificaciones" | "registro";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const c = getCourse(Number((await params).id));
  return { title: c?.title ?? "Curso" };
}

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: Tab }>;
}) {
  const user = await requireUser();
  const courseId = Number((await params).id);
  const { tab = "contenido" } = await searchParams;
  const course = getCourse(courseId);
  if (!course || (!course.published && user.role === "alumno")) notFound();

  const tree = getCourseTree(courseId);
  const enrollment = getEnrollment(user.id, courseId);
  const statuses = enrollment ? unitStatuses(enrollment.id) : new Map();
  const progress = enrollment ? progressFor(enrollment.id, courseId) : null;
  const next = enrollment ? nextUnit(enrollment.id, courseId) : undefined;
  const totalMin = tree.flatMap((m) => m.units).reduce((a, u) => a + u.duration_min, 0);

  return (
    <>
      <div className="small muted" style={{ marginBottom: 12 }}>
        <Link href="/mis-cursos">Mis cursos</Link> / {course.title}
      </div>

      <section className="hero">
        <div>
          <div className="actions" style={{ marginBottom: 10 }}>
            <span className="badge solid">{PRODUCT_LABEL[course.product] ?? course.product}</span>
            {course.mandatory ? <span className="badge warn">Obligatorio</span> : null}
            {enrollment && (
              <span className={`badge ${enrollment.status === "completado" ? "ok" : enrollment.status === "inscrito" ? "grey" : ""}`}>
                {STATUS_LABEL[enrollment.status]}
              </span>
            )}
            {!course.published && <span className="badge danger">Borrador</span>}
          </div>
          <h1>{course.title}</h1>
          <p className="muted" style={{ marginBottom: 0 }}>
            {course.description}
          </p>
          <div className="facts">
            <div>
              <span>Duración</span>
              <b>{course.hours} h</b>
            </div>
            <div>
              <span>Modalidad</span>
              <b>{course.modality}</b>
            </div>
            <div>
              <span>Estructura</span>
              <b>
                {tree.length} módulos · {tree.flatMap((m) => m.units).length} unidades
              </b>
            </div>
            <div>
              <span>Nota mínima</span>
              <b>{course.passing_score}/100</b>
            </div>
          </div>
          <div className="actions" style={{ marginTop: 20 }}>
            {!enrollment ? (
              <form action={enrollSelf.bind(null, courseId)}>
                <button className="btn accent">Inscribirme</button>
              </form>
            ) : (
              <>
                {next && (
                  <Link className="btn accent" href={`/cursos/${courseId}/unidad/${next.id}`}>
                    <Icon name="play" /> {enrollment.status === "inscrito" ? "Empezar" : enrollment.status === "completado" ? "Repasar" : "Continuar"}
                  </Link>
                )}
                {enrollment.status === "completado" && (
                  <Link className="btn ghost" href={`/certificado/${enrollment.id}`}>
                    <Icon name="award" /> Certificado
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
        <div className="hero-art">
          {progress ? (
            <ProgressRing percent={progress.percent} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={PRODUCT_ILLUSTRATION[course.product] ?? PRODUCT_ILLUSTRATION.general} alt="" />
          )}
        </div>
      </section>

      {enrollment && (
        <nav className="tabs">
          {(
            [
              ["contenido", "Contenido"],
              ["progreso", "Progreso"],
              ["calificaciones", "Calificaciones"],
              ["registro", "Registro de actividad"],
            ] as const
          ).map(([k, label]) => (
            <Link key={k} href={`/cursos/${courseId}?tab=${k}`} className={tab === k ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
      )}

      {(tab === "contenido" || !enrollment) && (
        <div>
          {!enrollment && <h2 style={{ marginTop: 8 }}>Temario</h2>}
          {tree.map((m, i) => {
            const done = m.units.filter((u) => statuses.get(u.id)?.status === "completado").length;
            return (
              <details className="module" key={m.id} open={i === 0 || !!enrollment}>
                <summary>
                  <span className="pill-num">{i + 1}</span>
                  <div>
                    <h3>{m.title}</h3>
                    <span className="small muted">
                      {m.units.length} unidades{enrollment ? ` · ${done}/${m.units.length} completadas` : ""}
                    </span>
                  </div>
                  <span className="chev">
                    <Icon name="chevron" />
                  </span>
                </summary>
                <ul className="unit-list">
                  {m.units.map((u) => {
                    const st = statuses.get(u.id)?.status;
                    const inner = (
                      <>
                        <span className={`state ${st ?? ""}`}>{st === "completado" && <Icon name="check" />}</span>
                        <Icon name={UNIT_ICON[u.type]} />
                        <span>{u.title}</span>
                        <span className="meta">
                          <span className="badge grey">{UNIT_TYPE_LABEL[u.type]}</span>
                          <span className="nowrap">{u.duration_min} min</span>
                        </span>
                      </>
                    );
                    return (
                      <li key={u.id}>
                        {enrollment ? <Link href={`/cursos/${courseId}/unidad/${u.id}`}>{inner}</Link> : <a>{inner}</a>}
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
          <p className="small muted" style={{ marginTop: 12 }}>
            Duración estimada de las unidades: {Math.round(totalMin / 6) / 10} h
          </p>
        </div>
      )}

      {enrollment && tab === "progreso" && progress && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Resumen</h3>
            <table className="table">
              <tbody>
                <tr><td>Estado</td><td>{STATUS_LABEL[enrollment.status]}</td></tr>
                <tr><td>Unidades completadas</td><td>{progress.completed} de {progress.total}</td></tr>
                <tr><td>Fecha de inscripción</td><td>{formatDate(enrollment.enrolled_at, true)}</td></tr>
                <tr><td>Primer acceso</td><td>{formatDate(enrollment.started_at, true)}</td></tr>
                <tr><td>Último acceso</td><td>{formatDate(enrollment.last_access_at, true)}</td></tr>
                <tr><td>Fecha de finalización</td><td>{formatDate(enrollment.completed_at, true)}</td></tr>
                <tr><td>Tiempo de dedicación</td><td>{formatDuration(enrollment.time_spent_sec)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card">
            <h3>Por módulo</h3>
            {tree.map((m) => {
              const done = m.units.filter((u) => statuses.get(u.id)?.status === "completado").length;
              const pct = m.units.length ? Math.round((done / m.units.length) * 100) : 0;
              return (
                <div key={m.id} style={{ marginBottom: 14 }}>
                  <div className="small" style={{ marginBottom: 4 }}>{m.title}</div>
                  <ProgressBar percent={pct} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {enrollment && tab === "calificaciones" && <Grades enrollmentId={enrollment.id} passing={course.passing_score} />}

      {enrollment && tab === "registro" && (
        <div className="card">
          <ul className="timeline">
            {recentActivity(user.id, 200, courseId).map((a) => (
              <li key={a.id}>
                <time>{formatDate(a.created_at, true)}</time>
                <span>
                  {ACTION_LABEL[a.action] ?? a.action}
                  {a.unit_title ? ` · ${a.unit_title}` : ""}
                  {a.detail ? <span className="muted"> · {a.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Grades({ enrollmentId, passing }: { enrollmentId: number; passing: number }) {
  const rows = getDb()
    .prepare(
      `SELECT q.id, q.score, q.passed, q.submitted_at, u.title FROM quiz_attempts q JOIN units u ON u.id = q.unit_id
       WHERE q.enrollment_id = ? ORDER BY q.id DESC`
    )
    .all(enrollmentId) as { id: number; score: number; passed: number; submitted_at: string; title: string }[];
  return (
    <div className="card">
      <p className="muted small">Nota mínima para aprobar: {passing}/100. Se tiene en cuenta la mejor nota.</p>
      {rows.length === 0 ? (
        <p className="muted">Aún no has realizado ninguna evaluación.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Evaluación</th><th>Fecha</th><th className="num">Nota</th><th>Resultado</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{formatDate(r.submitted_at, true)}</td>
                  <td className="num">{r.score}</td>
                  <td><span className={`badge ${r.passed ? "ok" : "danger"}`}>{r.passed ? "Apto" : "No apto"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
