import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { logActivity, requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Heartbeat } from "@/components/Heartbeat";
import { Icon, UNIT_ICON } from "@/components/Icon";
import { ProgressBar } from "@/components/Progress";
import { Prose } from "@/components/Prose";
import {
  UNIT_TYPE_LABEL, getCourse, getCourseTree, getEnrollment, parseQuiz, progressFor, touchUnit, unitStatuses,
} from "@/lib/learning";
import { markComplete } from "../../../../actions";
import { QuizForm } from "./QuizForm";

export default async function UnitPage({ params }: { params: Promise<{ id: string; unitId: string }> }) {
  const user = await requireUser();
  const { id, unitId: uid } = await params;
  const courseId = Number(id);
  const unitId = Number(uid);
  const course = getCourse(courseId);
  if (!course) notFound();
  const enrollment = getEnrollment(user.id, courseId);
  if (!enrollment) redirect(`/cursos/${courseId}`);

  const tree = getCourseTree(courseId);
  const flat = tree.flatMap((m) => m.units.map((u) => ({ ...u, moduleTitle: m.title })));
  const idx = flat.findIndex((u) => u.id === unitId);
  if (idx < 0) notFound();
  const unit = flat[idx];
  const prev = flat[idx - 1];
  const next = flat[idx + 1];

  touchUnit(enrollment, unitId);
  // Evita duplicar el registro de acceso en recargas seguidas.
  const last = getDb()
    .prepare("SELECT unit_id, created_at FROM activity_log WHERE user_id = ? AND action = 'unidad_vista' ORDER BY id DESC LIMIT 1")
    .get(user.id) as { unit_id: number; created_at: string } | undefined;
  if (!last || last.unit_id !== unitId || Date.now() - Date.parse(last.created_at.replace(" ", "T") + "Z") > 10 * 60_000) {
    await logActivity(user.id, "unidad_vista", { courseId, unitId });
  }

  const statuses = unitStatuses(enrollment.id);
  const progress = progressFor(enrollment.id, courseId);
  const completed = statuses.get(unitId)?.status === "completado";

  const attempts =
    unit.type === "test"
      ? (getDb()
          .prepare("SELECT score, passed, submitted_at FROM quiz_attempts WHERE enrollment_id = ? AND unit_id = ? ORDER BY id DESC")
          .all(enrollment.id, unitId) as { score: number; passed: number; submitted_at: string }[])
      : [];

  return (
    <>
      <Heartbeat unitId={unitId} />
      <div className="small muted" style={{ marginBottom: 12 }}>
        <Link href={`/cursos/${courseId}`}>{course.title}</Link> / {unit.moduleTitle}
      </div>
      <div className="player">
        <aside className="card player-index">
          <div style={{ padding: "0 8px 8px" }}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Tu progreso</div>
            <ProgressBar percent={progress.percent} />
          </div>
          {tree.map((m) => (
            <div key={m.id}>
              <h4>{m.title}</h4>
              {m.units.map((u) => {
                const st = statuses.get(u.id)?.status;
                return (
                  <Link key={u.id} href={`/cursos/${courseId}/unidad/${u.id}`} className={u.id === unitId ? "current" : ""}>
                    <span className={`state ${st ?? ""}`}>{st === "completado" && <Icon name="check" />}</span>
                    {u.title}
                  </Link>
                );
              })}
            </div>
          ))}
        </aside>

        <article className="card unit-body">
          <div className="eyebrow">
            <Icon name={UNIT_ICON[unit.type]} /> {UNIT_TYPE_LABEL[unit.type]} · {unit.duration_min} min
            {completed && <span className="badge ok">Completada</span>}
          </div>
          <h1 style={{ fontSize: 26 }}>{unit.title}</h1>

          {unit.type === "video" &&
            (unit.resource_url ? (
              <iframe className="media-frame" src={unit.resource_url} title={unit.title} allow="fullscreen; picture-in-picture" allowFullScreen />
            ) : (
              <div className="media-placeholder">
                <div>
                  <Icon name="play" size={40} />
                  <p style={{ margin: "8px 0 0" }}>Vídeo pendiente de publicar</p>
                </div>
              </div>
            ))}

          {unit.type === "documento" && (
            <div className="alert info" style={{ marginBottom: 20 }}>
              {unit.resource_url ? (
                <a href={unit.resource_url} target="_blank" rel="noreferrer" className="btn sm">
                  <Icon name="download" /> Abrir documento
                </a>
              ) : (
                "Documento pendiente de publicar."
              )}
            </div>
          )}

          {unit.type === "test" ? (
            <QuizForm
              unitId={unitId}
              questions={parseQuiz(unit).map(({ q, options }) => ({ q, options }))}
              passing={course.passing_score}
              intro={unit.content}
              attempts={attempts}
              alreadyPassed={completed}
            />
          ) : (
            <Prose text={unit.content} />
          )}

          <div className="unit-nav">
            {prev ? (
              <Link className="btn ghost" href={`/cursos/${courseId}/unidad/${prev.id}`}>
                <Icon name="left" /> Anterior
              </Link>
            ) : (
              <span />
            )}
            <div className="actions">
              {unit.type !== "test" && !completed && (
                <form action={markComplete.bind(null, unitId)}>
                  <button className="btn accent">
                    <Icon name="check" /> Marcar como completada
                  </button>
                </form>
              )}
              {next ? (
                <Link className="btn" href={`/cursos/${courseId}/unidad/${next.id}`}>
                  Siguiente <Icon name="chevron" />
                </Link>
              ) : (
                <Link className="btn" href={`/cursos/${courseId}`}>
                  Volver al curso
                </Link>
              )}
            </div>
          </div>
        </article>
      </div>
    </>
  );
}
