import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CourseCard } from "@/components/CourseCard";
import { Dots } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { ProgressBar } from "@/components/Progress";
import {
  ACTION_LABEL, formatDate, formatDuration, nextUnit, recentActivity, unitCount, userEnrollments,
} from "@/lib/learning";

export const metadata = { title: "Inicio" };

export default async function Inicio() {
  const user = await requireUser();
  const enrollments = userEnrollments(user.id);
  const active = enrollments.filter((e) => e.status !== "completado");
  const done = enrollments.filter((e) => e.status === "completado");
  const seconds = enrollments.reduce((a, e) => a + e.time_spent_sec, 0);
  const resume = [...active].sort((a, b) => (b.last_access_at ?? "").localeCompare(a.last_access_at ?? ""))[0];
  const resumeUnit = resume ? nextUnit(resume.enrollment_id, resume.course_id) : undefined;
  const pendingMandatory = active.filter((e) => e.mandatory);
  const activity = recentActivity(user.id, 6);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <Dots /> Tu formación
          </div>
          <h1>
            <span className="accent">Hola,</span> {user.first_name}
          </h1>
        </div>
        <Link href="/catalogo" className="btn ghost">
          Ver catálogo
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card stat">
          <div className="num">{enrollments.length}</div>
          <div className="lbl">Cursos inscritos</div>
        </div>
        <div className="card stat">
          <div className="num">{active.length}</div>
          <div className="lbl">Pendientes</div>
        </div>
        <div className="card stat">
          <div className="num">{done.length}</div>
          <div className="lbl">Completados</div>
        </div>
        <div className="card stat">
          <div className="num">{formatDuration(seconds)}</div>
          <div className="lbl">Tiempo de formación</div>
        </div>
      </div>

      <div className="split">
        <div>
          {resume && resumeUnit && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="eyebrow">Continúa donde lo dejaste</div>
              <h2 style={{ marginBottom: 4 }}>{resume.title}</h2>
              <p className="muted" style={{ marginBottom: 16 }}>
                Siguiente: {resumeUnit.title}
              </p>
              <ProgressBar percent={resume.progress.percent} />
              <div className="actions" style={{ marginTop: 16 }}>
                <Link className="btn accent" href={`/cursos/${resume.course_id}/unidad/${resumeUnit.id}`}>
                  <Icon name="play" /> Continuar
                </Link>
                <Link className="btn ghost" href={`/cursos/${resume.course_id}`}>
                  Ver curso
                </Link>
              </div>
            </div>
          )}

          <div className="card-title">
            <h2>Mis cursos</h2>
            <Link href="/mis-cursos" className="small">
              Ver todos
            </Link>
          </div>
          {enrollments.length === 0 ? (
            <div className="card empty">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/illustrations/mapachin-birrete.svg" alt="" />
              <p>Todavía no estás inscrito en ningún curso.</p>
              <Link href="/catalogo" className="btn">
                Explorar catálogo
              </Link>
            </div>
          ) : (
            <div className="grid grid-2">
              {enrollments.slice(0, 4).map((e) => (
                <CourseCard key={e.enrollment_id} course={{ ...e, id: e.course_id }} enrollment={e} progress={e.progress} units={unitCount(e.course_id)} />
              ))}
            </div>
          )}
        </div>

        <aside>
          <div className="card">
            <h3>Formación obligatoria</h3>
            {pendingMandatory.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                <Icon name="check" size={14} /> Estás al día.
              </p>
            ) : (
              <ul className="timeline">
                {pendingMandatory.map((e) => (
                  <li key={e.enrollment_id} style={{ gridTemplateColumns: "1fr" }}>
                    <Link href={`/cursos/${e.course_id}`}>{e.title}</Link>
                    <ProgressBar percent={e.progress.percent} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <div className="card-title">
              <h3>Actividad reciente</h3>
              <Link href="/expediente" className="small">
                Expediente
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="muted small">Sin actividad todavía.</p>
            ) : (
              <ul className="timeline">
                {activity.map((a) => (
                  <li key={a.id} style={{ gridTemplateColumns: "1fr" }}>
                    <time>{formatDate(a.created_at, true)}</time>
                    <span className="small">
                      {ACTION_LABEL[a.action] ?? a.action}
                      {a.course_title ? ` · ${a.course_title}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
