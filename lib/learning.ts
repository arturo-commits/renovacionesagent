import "server-only";
import { getDb } from "./db";

export type Course = {
  id: number; slug: string; title: string; subtitle: string | null; description: string | null;
  product: string; hours: number; modality: string; passing_score: number; mandatory: number; published: number;
};
export type Module = { id: number; course_id: number; position: number; title: string; description: string | null };
export type Unit = {
  id: number; module_id: number; position: number; title: string;
  type: "lectura" | "video" | "documento" | "test";
  content: string | null; resource_url: string | null; duration_min: number; quiz_json: string | null;
};
export type Enrollment = {
  id: number; user_id: number; course_id: number; status: "inscrito" | "en_curso" | "completado";
  enrolled_at: string; started_at: string | null; last_access_at: string | null; completed_at: string | null;
  time_spent_sec: number; final_score: number | null; due_at: string | null;
};
export type QuizQuestion = { q: string; options: string[]; correct: number };

export const PRODUCT_LABEL: Record<string, string> = {
  general: "Tuio", hogar: "Hogar", auto: "Auto", mascotas: "Mascotas", vida: "Vida",
};
export const PRODUCT_ILLUSTRATION: Record<string, string> = {
  general: "/illustrations/mapachin-birrete.svg",
  hogar: "/illustrations/hogar.svg",
  auto: "/illustrations/auto.svg",
  mascotas: "/illustrations/mascotas.svg",
  vida: "/illustrations/vida.svg",
};
export const UNIT_TYPE_LABEL: Record<Unit["type"], string> = {
  lectura: "Lectura", video: "Vídeo", documento: "Documento", test: "Test",
};

export function getCourse(id: number): Course | undefined {
  return getDb().prepare("SELECT * FROM courses WHERE id = ?").get(id) as Course | undefined;
}

export function listCourses(opts: { publishedOnly?: boolean } = {}): Course[] {
  return getDb()
    .prepare(`SELECT * FROM courses ${opts.publishedOnly ? "WHERE published = 1" : ""} ORDER BY mandatory DESC, id`)
    .all() as Course[];
}

export function getCourseTree(courseId: number): (Module & { units: Unit[] })[] {
  const db = getDb();
  const modules = db.prepare("SELECT * FROM modules WHERE course_id = ? ORDER BY position, id").all(courseId) as Module[];
  const units = db
    .prepare(
      `SELECT u.* FROM units u JOIN modules m ON m.id = u.module_id
       WHERE m.course_id = ? ORDER BY m.position, m.id, u.position, u.id`
    )
    .all(courseId) as Unit[];
  return modules.map((m) => ({ ...m, units: units.filter((u) => u.module_id === m.id) }));
}

export function getUnitWithCourse(unitId: number): (Unit & { course_id: number }) | undefined {
  return getDb()
    .prepare("SELECT u.*, m.course_id FROM units u JOIN modules m ON m.id = u.module_id WHERE u.id = ?")
    .get(unitId) as (Unit & { course_id: number }) | undefined;
}

export function getEnrollment(userId: number, courseId: number): Enrollment | undefined {
  return getDb()
    .prepare("SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?")
    .get(userId, courseId) as Enrollment | undefined;
}

export function getEnrollmentById(id: number): Enrollment | undefined {
  return getDb().prepare("SELECT * FROM enrollments WHERE id = ?").get(id) as Enrollment | undefined;
}

/** Inscribe (si no lo estaba). Con dueAt fija o adelanta la fecha límite de una matrícula no completada. */
export function enroll(userId: number, courseId: number, enrolledBy?: number, dueAt?: string | null) {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO enrollments (user_id, course_id, enrolled_by, due_at) VALUES (?, ?, ?, ?)").run(
    userId, courseId, enrolledBy ?? userId, dueAt ?? null
  );
  if (dueAt)
    db.prepare(
      `UPDATE enrollments SET due_at = ? WHERE user_id = ? AND course_id = ? AND status <> 'completado'
       AND (due_at IS NULL OR due_at > ?)`
    ).run(dueAt, userId, courseId, dueAt);
}

/** true si la matrícula tiene fecha límite pasada y no está completada. */
export function isOverdue(e: Pick<Enrollment, "due_at" | "status">): boolean {
  return !!e.due_at && e.status !== "completado" && e.due_at < new Date().toISOString().slice(0, 10);
}

export function unitStatuses(enrollmentId: number): Map<number, { status: string; time_spent_sec: number }> {
  const rows = getDb()
    .prepare("SELECT unit_id, status, time_spent_sec FROM unit_progress WHERE enrollment_id = ?")
    .all(enrollmentId) as { unit_id: number; status: string; time_spent_sec: number }[];
  return new Map(rows.map((r) => [r.unit_id, r]));
}

export type Progress = { total: number; completed: number; percent: number };

export function progressFor(enrollmentId: number, courseId: number): Progress {
  const db = getDb();
  const { total } = db
    .prepare("SELECT COUNT(*) AS total FROM units u JOIN modules m ON m.id = u.module_id WHERE m.course_id = ?")
    .get(courseId) as { total: number };
  const { completed } = db
    .prepare(
      `SELECT COUNT(*) AS completed FROM unit_progress p
       JOIN units u ON u.id = p.unit_id JOIN modules m ON m.id = u.module_id
       WHERE p.enrollment_id = ? AND p.status = 'completado' AND m.course_id = ?`
    )
    .get(enrollmentId, courseId) as { completed: number };
  return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
}

/** Marca el acceso a una unidad y pasa la matrícula a "en curso". */
export function touchUnit(enrollment: Enrollment, unitId: number) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO unit_progress (enrollment_id, unit_id) VALUES (?, ?)").run(enrollment.id, unitId);
  db.prepare(
    `UPDATE enrollments SET last_access_at = ?, started_at = COALESCE(started_at, ?),
       status = CASE WHEN status = 'inscrito' THEN 'en_curso' ELSE status END WHERE id = ?`
  ).run(now, now, enrollment.id);
}

/** Marca una unidad como completada y, si es la última, cierra el curso. Devuelve true si el curso queda completado. */
export function completeUnit(enrollment: Enrollment, unitId: number): boolean {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO unit_progress (enrollment_id, unit_id) VALUES (?, ?)").run(enrollment.id, unitId);
  db.prepare(
    `UPDATE unit_progress SET status = 'completado', completed_at = COALESCE(completed_at, datetime('now'))
     WHERE enrollment_id = ? AND unit_id = ?`
  ).run(enrollment.id, unitId);
  return maybeCompleteCourse(enrollment);
}

function maybeCompleteCourse(enrollment: Enrollment): boolean {
  if (enrollment.status === "completado") return false;
  const p = progressFor(enrollment.id, enrollment.course_id);
  if (p.total === 0 || p.completed < p.total) return false;
  const db = getDb();
  const best = db
    .prepare(
      `SELECT MAX(score) AS s FROM quiz_attempts WHERE enrollment_id = ? AND passed = 1`
    )
    .get(enrollment.id) as { s: number | null };
  db.prepare(
    "UPDATE enrollments SET status = 'completado', completed_at = datetime('now'), final_score = ? WHERE id = ?"
  ).run(best.s, enrollment.id);
  return true;
}

export function addTime(enrollmentId: number, unitId: number, seconds: number) {
  const db = getDb();
  db.prepare("UPDATE enrollments SET time_spent_sec = time_spent_sec + ?, last_access_at = datetime('now') WHERE id = ?").run(
    seconds,
    enrollmentId
  );
  db.prepare("UPDATE unit_progress SET time_spent_sec = time_spent_sec + ? WHERE enrollment_id = ? AND unit_id = ?").run(
    seconds,
    enrollmentId,
    unitId
  );
}

export function parseQuiz(unit: Unit): QuizQuestion[] {
  try {
    const q = JSON.parse(unit.quiz_json || "[]");
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}

export type EnrollmentRow = Enrollment & Course & { enrollment_id: number };

/** Matrículas de un usuario con los datos del curso. */
export function userEnrollments(userId: number): (EnrollmentRow & { progress: Progress })[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, e.*, e.id AS enrollment_id FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = ? ORDER BY CASE e.status WHEN 'en_curso' THEN 0 WHEN 'inscrito' THEN 1 ELSE 2 END, e.enrolled_at DESC`
    )
    .all(userId) as EnrollmentRow[];
  return rows.map((r) => ({ ...r, progress: progressFor(r.enrollment_id, r.course_id) }));
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h} h ${m.toString().padStart(2, "0")} min`;
  return `${m} min`;
}

export function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.split("-").reverse().join("/");
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/Madrid",
  });
}

export const STATUS_LABEL: Record<Enrollment["status"], string> = {
  inscrito: "No iniciado", en_curso: "En curso", completado: "Completado",
};

/** Primera unidad no completada del curso (o la primera si todo está completo). */
export function nextUnit(enrollmentId: number, courseId: number): Unit | undefined {
  const units = getCourseTree(courseId).flatMap((m) => m.units);
  const st = unitStatuses(enrollmentId);
  return units.find((u) => st.get(u.id)?.status !== "completado") ?? units[0];
}

export function unitCount(courseId: number): number {
  return (
    getDb()
      .prepare("SELECT COUNT(*) AS n FROM units u JOIN modules m ON m.id = u.module_id WHERE m.course_id = ?")
      .get(courseId) as { n: number }
  ).n;
}

export const ACTION_LABEL: Record<string, string> = {
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
  registro: "Alta en la plataforma",
  inscripcion: "Inscripción en curso",
  inscripcion_admin: "Inscrito por gestión",
  baja_admin: "Baja de curso por gestión",
  alta_admin: "Alta por gestión",
  importacion: "Alta por importación",
  invitacion: "Invitación generada",
  password_restablecida: "Contraseña restablecida",
  rol_cambiado: "Rol cambiado",
  activacion: "Cuenta activada",
  grupo_alta: "Añadido a grupo",
  grupo_baja: "Retirado de grupo",
  fecha_limite: "Fecha límite cambiada",
  usuario_activado: "Usuario activado",
  usuario_desactivado: "Usuario desactivado",
  unidad_vista: "Acceso a unidad",
  unidad_completada: "Unidad completada",
  test_enviado: "Test enviado",
  curso_completado: "Curso completado",
  perfil_actualizado: "Perfil actualizado",
  password_cambiada: "Contraseña cambiada",
};

export type ActivityRow = {
  id: number; action: string; detail: string | null; created_at: string; ip: string | null;
  course_title: string | null; unit_title: string | null; course_id: number | null;
};

export function recentActivity(userId: number, limit = 50, courseId?: number): ActivityRow[] {
  return getDb()
    .prepare(
      `SELECT a.id, a.action, a.detail, a.created_at, a.ip, a.course_id, c.title AS course_title, u.title AS unit_title
       FROM activity_log a LEFT JOIN courses c ON c.id = a.course_id LEFT JOIN units u ON u.id = a.unit_id
       WHERE a.user_id = ? ${courseId ? "AND a.course_id = ?" : ""}
       ORDER BY a.id DESC LIMIT ?`
    )
    .all(...(courseId ? [userId, courseId, limit] : [userId, limit])) as ActivityRow[];
}
