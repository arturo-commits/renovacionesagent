import "server-only";
import { getDb } from "./db";
import { formatDate } from "./learning";
import { mailEnabled, sendMail, type MailResult } from "./mail";
import {
  completionMail, enrollmentMail, invitationMail, reminderMail, resetMail, type ReminderItem,
} from "./mail-templates";
import { baseUrl, createInvitation, type InvitationKind } from "./students";

type U = { id: number; first_name: string; email: string; active: number };
const userById = (id: number) => getDb().prepare("SELECT id, first_name, email, active FROM users WHERE id = ?").get(id) as U | undefined;

/** Crea el enlace (activación o restablecimiento) y lo envía por correo si está configurado. */
export async function sendAccessLink(userId: number, by: number | null, kind: InvitationKind = "activacion"): Promise<{ link: string; mail: MailResult | null }> {
  const u = userById(userId)!;
  const link = await createInvitation(userId, by, kind);
  if (!mailEnabled()) return { link, mail: null };
  const m = kind === "reset" ? resetMail(u.first_name, link) : invitationMail(u.first_name, link);
  const mail = await sendMail({ ...m, to: u.email, kind: kind === "reset" ? "reset" : "invitacion", userId, sentBy: by });
  return { link, mail };
}

export async function notifyEnrollment(userId: number, courseIds: number[], due: string | null, by: number | null) {
  const u = userById(userId);
  if (!u || !u.active || !courseIds.length || !mailEnabled()) return null;
  const titles = (getDb().prepare(`SELECT title FROM courses WHERE id IN (${courseIds.map(() => "?").join(",")})`).all(...courseIds) as { title: string }[]).map((c) => c.title);
  const m = enrollmentMail(u.first_name, titles, due ? formatDate(due) : null, `${await baseUrl()}/mis-cursos`);
  return sendMail({ ...m, to: u.email, kind: "inscripcion", userId, sentBy: by });
}

export async function notifyCompletion(userId: number, enrollmentId: number) {
  if (!mailEnabled()) return null;
  const u = userById(userId);
  const c = getDb().prepare("SELECT c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.id = ?").get(enrollmentId) as { title: string } | undefined;
  if (!u || !c) return null;
  const m = completionMail(u.first_name, c.title, `${await baseUrl()}/certificado/${enrollmentId}`);
  return sendMail({ ...m, to: u.email, kind: "certificado", userId });
}

/* ---------- Recordatorios ---------- */

type Pending = { enrollment_id: number; user_id: number; first_name: string; email: string; course: string; due_at: string | null; kind: ReminderItem["kind"] };

/**
 * Reglas automáticas (se lanzan a diario desde el cron o el botón «Ejecutar ahora»):
 *  - vence_pronto: fecha límite en los próximos 7 días → una vez por fecha límite.
 *  - vencido: fecha límite superada → como mucho una vez por semana.
 *  - sin_empezar: inscrito hace más de 7 días sin abrir el curso → una sola vez.
 * Se envía un único correo por alumno con todos sus pendientes.
 */
export async function runAutomaticReminders(by: number | null = null) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const base = `SELECT e.id AS enrollment_id, u.id AS user_id, u.first_name, u.email, c.title AS course, e.due_at
    FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id
    WHERE u.active = 1 AND u.password_hash NOT LIKE '!%' AND e.status <> 'completado'`;
  const pending: Pending[] = [
    ...(db.prepare(`${base} AND e.due_at >= ? AND e.due_at <= date(?, '+7 days')
        AND NOT EXISTS (SELECT 1 FROM reminder_log r WHERE r.enrollment_id = e.id AND r.kind = 'vence_pronto' AND r.ref = e.due_at)`)
      .all(today, today) as Omit<Pending, "kind">[]).map((r) => ({ ...r, kind: "vence_pronto" as const })),
    ...(db.prepare(`${base} AND e.due_at < ?
        AND NOT EXISTS (SELECT 1 FROM reminder_log r WHERE r.enrollment_id = e.id AND r.kind = 'vencido' AND r.sent_at > datetime('now', '-7 days'))`)
      .all(today) as Omit<Pending, "kind">[]).map((r) => ({ ...r, kind: "vencido" as const })),
    ...(db.prepare(`${base} AND e.status = 'inscrito' AND e.enrolled_at < datetime('now', '-7 days')
        AND NOT EXISTS (SELECT 1 FROM reminder_log r WHERE r.enrollment_id = e.id AND r.kind = 'sin_empezar')`)
      .all() as Omit<Pending, "kind">[]).map((r) => ({ ...r, kind: "sin_empezar" as const })),
  ];
  return deliver(pending, by);
}

/** Recordatorio manual desde Seguimiento a una lista de matrículas. */
export async function remindEnrollments(enrollmentIds: number[], kind: ReminderItem["kind"], by: number) {
  if (!enrollmentIds.length) return { users: 0, sent: 0, failed: 0, notConfigured: !mailEnabled() };
  const rows = getDb()
    .prepare(
      `SELECT e.id AS enrollment_id, u.id AS user_id, u.first_name, u.email, c.title AS course, e.due_at
       FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id
       WHERE u.active = 1 AND e.id IN (${enrollmentIds.map(() => "?").join(",")})`
    )
    .all(...enrollmentIds) as Omit<Pending, "kind">[];
  return deliver(rows.map((r) => ({ ...r, kind })), by);
}

async function deliver(pending: Pending[], by: number | null) {
  const db = getDb();
  if (!mailEnabled()) return { users: new Set(pending.map((p) => p.user_id)).size, sent: 0, failed: 0, notConfigured: true };
  const byUser = new Map<number, Pending[]>();
  for (const p of pending) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p]);
  const url = `${await baseUrl()}/mis-cursos`;
  const log = db.prepare("INSERT INTO reminder_log (enrollment_id, kind, ref) VALUES (?, ?, ?)");
  let sent = 0;
  let failed = 0;
  for (const [userId, items] of byUser) {
    const m = reminderMail(items[0].first_name, items.map((i) => ({ course: i.course, kind: i.kind, date: i.due_at ? formatDate(i.due_at) : null })), url);
    const r = await sendMail({ ...m, to: items[0].email, kind: "recordatorio", userId, sentBy: by });
    if (r.ok) {
      sent++;
      for (const i of items) log.run(i.enrollment_id, i.kind, i.due_at);
    } else failed++;
  }
  return { users: byUser.size, sent, failed, notConfigured: false };
}
