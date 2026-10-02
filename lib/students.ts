import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { getDb } from "./db";
import { enroll, progressFor } from "./learning";

/* ---------- Listado de alumnos con filtros ---------- */

export const SEGMENTS = {
  activos: "Activos",
  inactivos: "Desactivados",
  pendientes_activar: "Pendientes de activar cuenta",
  sin_acceso: "Nunca han accedido",
  obligatoria_pendiente: "Con obligatoria pendiente",
  vencidos: "Con formación vencida",
  sin_actividad_30: "Sin actividad en 30 días",
  al_dia: "Al día",
} as const;
export type Segment = keyof typeof SEGMENTS;

const TODAY = () => new Date().toISOString().slice(0, 10);

const SEGMENT_SQL: Record<Segment, string> = {
  activos: "u.active = 1",
  inactivos: "u.active = 0",
  pendientes_activar: "u.password_hash LIKE '!%'",
  sin_acceso: "u.last_login_at IS NULL",
  obligatoria_pendiente: `EXISTS (SELECT 1 FROM enrollments x JOIN courses c ON c.id = x.course_id
    WHERE x.user_id = u.id AND c.mandatory = 1 AND x.status <> 'completado')`,
  vencidos: `EXISTS (SELECT 1 FROM enrollments x WHERE x.user_id = u.id AND x.status <> 'completado'
    AND x.due_at IS NOT NULL AND x.due_at < @today)`,
  sin_actividad_30: `COALESCE((SELECT MAX(a.created_at) FROM activity_log a WHERE a.user_id = u.id), '') < datetime('now', '-30 days')`,
  al_dia: `u.active = 1 AND NOT EXISTS (SELECT 1 FROM enrollments x JOIN courses c ON c.id = x.course_id
    WHERE x.user_id = u.id AND x.status <> 'completado' AND (c.mandatory = 1 OR (x.due_at IS NOT NULL AND x.due_at < @today)))`,
};

export const SORTS = {
  nombre: "u.last_name COLLATE NOCASE, u.first_name COLLATE NOCASE",
  email: "u.email",
  departamento: "u.department COLLATE NOCASE",
  cursos: "enrolled",
  completados: "completed",
  acceso: "u.last_login_at",
  alta: "u.created_at",
} as const;
export type Sort = keyof typeof SORTS;

export type StudentFilters = {
  q?: string; department?: string; segment?: Segment | ""; courseId?: number; groupId?: number; role?: string;
  sort?: Sort; dir?: "asc" | "desc"; page?: number; pageSize?: number;
};

export type StudentRow = {
  id: number; first_name: string; last_name: string; email: string; nif: string | null; phone: string | null;
  company: string | null; department: string | null; job_title: string | null; role: string; active: number;
  pending: number; created_at: string; last_login_at: string | null; last_activity_at: string | null;
  enrolled: number; completed: number; overdue: number; mandatory_pending: number; time_sec: number;
};

export function listStudents(f: StudentFilters): { rows: StudentRow[]; total: number } {
  const where: string[] = [];
  const params: Record<string, string | number> = { today: TODAY() };
  if (f.q) {
    where.push("(u.first_name || ' ' || u.last_name || ' ' || u.email || ' ' || COALESCE(u.nif, '')) LIKE @q");
    params.q = `%${f.q}%`;
  }
  if (f.department) { where.push("u.department = @department"); params.department = f.department; }
  if (f.role) { where.push("u.role = @role"); params.role = f.role; }
  if (f.segment && SEGMENT_SQL[f.segment]) where.push(SEGMENT_SQL[f.segment]);
  if (f.courseId) {
    where.push("EXISTS (SELECT 1 FROM enrollments y WHERE y.user_id = u.id AND y.course_id = @courseId)");
    params.courseId = f.courseId;
  }
  if (f.groupId) {
    where.push("EXISTS (SELECT 1 FROM group_members gm WHERE gm.user_id = u.id AND gm.group_id = @groupId)");
    params.groupId = f.groupId;
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM users u ${whereSql}`).get(params) as { n: number }).n;
  const order = SORTS[f.sort ?? "nombre"] ?? SORTS.nombre;
  const dir = f.dir === "desc" ? "DESC" : "ASC";
  const size = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const rows = db
    .prepare(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.nif, u.phone, u.company, u.department, u.job_title, u.role, u.active,
        CASE WHEN u.password_hash LIKE '!%' THEN 1 ELSE 0 END AS pending, u.created_at, u.last_login_at,
        (SELECT MAX(a.created_at) FROM activity_log a WHERE a.user_id = u.id) AS last_activity_at,
        (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrolled,
        (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status = 'completado') AS completed,
        (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.status <> 'completado' AND e.due_at < @today) AS overdue,
        (SELECT COUNT(*) FROM enrollments e JOIN courses c ON c.id = e.course_id
          WHERE e.user_id = u.id AND c.mandatory = 1 AND e.status <> 'completado') AS mandatory_pending,
        (SELECT COALESCE(SUM(e.time_spent_sec), 0) FROM enrollments e WHERE e.user_id = u.id) AS time_sec
       FROM users u ${whereSql}
       ORDER BY ${order} ${dir}, u.id
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: size, offset: (page - 1) * size }) as StudentRow[];
  return { rows, total };
}

export function departments(): string[] {
  return (
    getDb()
      .prepare("SELECT DISTINCT department FROM users WHERE department IS NOT NULL AND department <> '' ORDER BY 1")
      .all() as { department: string }[]
  ).map((r) => r.department);
}

/* ---------- Cuentas sin contraseña e invitaciones ---------- */

/** Hash imposible de verificar: la cuenta existe pero no puede entrar hasta activarse. */
export const PENDING_HASH = () => "!" + crypto.randomBytes(16).toString("hex");

const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");
const INVITE_DAYS = 14;

export async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Crea un enlace de activación (invalida los anteriores del usuario) y devuelve la URL. */
export async function createInvitation(userId: number, createdBy: number): Promise<string> {
  const db = getDb();
  const token = crypto.randomBytes(24).toString("base64url");
  db.prepare("DELETE FROM invitations WHERE user_id = ? AND used_at IS NULL").run(userId);
  db.prepare("INSERT INTO invitations (token_hash, user_id, created_by, expires_at) VALUES (?, ?, ?, ?)").run(
    sha(token), userId, createdBy, new Date(Date.now() + INVITE_DAYS * 86400_000).toISOString()
  );
  return `${await baseUrl()}/activar/${token}`;
}

export function findInvitation(token: string) {
  return getDb()
    .prepare(
      `SELECT i.token_hash, i.user_id, i.expires_at, i.used_at, u.first_name, u.email, u.active
       FROM invitations i JOIN users u ON u.id = i.user_id WHERE i.token_hash = ?`
    )
    .get(sha(token)) as
    | { token_hash: string; user_id: number; expires_at: string; used_at: string | null; first_name: string; email: string; active: number }
    | undefined;
}

export function redeemInvitation(token: string, password: string) {
  const db = getDb();
  const inv = findInvitation(token);
  if (!inv) return;
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, last_login_at = datetime('now') WHERE id = ?").run(bcrypt.hashSync(password, 10), inv.user_id);
    db.prepare("UPDATE invitations SET used_at = datetime('now') WHERE token_hash = ?").run(inv.token_hash);
  })();
  return inv.user_id;
}

export function pendingInvitation(userId: number) {
  return getDb()
    .prepare("SELECT created_at, expires_at FROM invitations WHERE user_id = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .get(userId) as { created_at: string; expires_at: string } | undefined;
}

/* ---------- Grupos / convocatorias ---------- */

export type Group = {
  id: number; name: string; description: string | null; tutor_id: number | null; start_date: string | null; end_date: string | null;
  created_at: string;
};

export function listGroups() {
  return getDb()
    .prepare(
      `SELECT g.*, t.first_name || ' ' || t.last_name AS tutor_name,
        (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS members,
        (SELECT COUNT(*) FROM group_courses c WHERE c.group_id = g.id) AS courses
       FROM groups g LEFT JOIN users t ON t.id = g.tutor_id ORDER BY COALESCE(g.start_date, g.created_at) DESC`
    )
    .all() as (Group & { tutor_name: string | null; members: number; courses: number })[];
}

export function getGroup(id: number) {
  return getDb().prepare("SELECT * FROM groups WHERE id = ?").get(id) as Group | undefined;
}

export function groupCourseIds(groupId: number): number[] {
  return (getDb().prepare("SELECT course_id FROM group_courses WHERE group_id = ?").all(groupId) as { course_id: number }[]).map((r) => r.course_id);
}

export function userGroups(userId: number) {
  return getDb()
    .prepare("SELECT g.id, g.name, g.end_date FROM group_members m JOIN groups g ON g.id = m.group_id WHERE m.user_id = ? ORDER BY g.name")
    .all(userId) as { id: number; name: string; end_date: string | null }[];
}

/** Añade usuarios al grupo e inscribe en sus cursos con la fecha de fin como fecha límite. */
export function addGroupMembers(groupId: number, userIds: number[], by: number) {
  const db = getDb();
  const g = getGroup(groupId);
  if (!g) return 0;
  const courses = groupCourseIds(groupId);
  const ins = db.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)");
  let added = 0;
  db.transaction(() => {
    for (const uid of userIds) {
      added += ins.run(groupId, uid).changes;
      for (const c of courses) enroll(uid, c, by, g.end_date);
    }
  })();
  return added;
}

export function addGroupCourse(groupId: number, courseId: number, by: number) {
  const db = getDb();
  const g = getGroup(groupId);
  if (!g) return;
  db.prepare("INSERT OR IGNORE INTO group_courses (group_id, course_id) VALUES (?, ?)").run(groupId, courseId);
  const members = db.prepare("SELECT user_id FROM group_members WHERE group_id = ?").all(groupId) as { user_id: number }[];
  db.transaction(() => members.forEach((m) => enroll(m.user_id, courseId, by, g.end_date)))();
}

export function groupProgress(groupId: number) {
  const db = getDb();
  const courses = db
    .prepare("SELECT c.id, c.title FROM group_courses gc JOIN courses c ON c.id = gc.course_id WHERE gc.group_id = ? ORDER BY c.title")
    .all(groupId) as { id: number; title: string }[];
  const members = db
    .prepare(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.department, u.active, u.last_login_at
       FROM group_members m JOIN users u ON u.id = m.user_id WHERE m.group_id = ? ORDER BY u.last_name, u.first_name`
    )
    .all(groupId) as { id: number; first_name: string; last_name: string; email: string; department: string | null; active: number; last_login_at: string | null }[];
  const enr = db.prepare("SELECT id, status, due_at FROM enrollments WHERE user_id = ? AND course_id = ?");
  return {
    courses,
    members: members.map((m) => ({
      ...m,
      cells: courses.map((c) => {
        const e = enr.get(m.id, c.id) as { id: number; status: string; due_at: string | null } | undefined;
        return e ? { status: e.status, due_at: e.due_at, percent: progressFor(e.id, c.id).percent } : null;
      }),
    })),
  };
}

/* ---------- Notas internas ---------- */

export function userNotes(userId: number) {
  return getDb()
    .prepare(
      `SELECT n.id, n.body, n.created_at, n.author_id, a.first_name || ' ' || a.last_name AS author
       FROM user_notes n LEFT JOIN users a ON a.id = n.author_id WHERE n.user_id = ? ORDER BY n.id DESC`
    )
    .all(userId) as { id: number; body: string; created_at: string; author_id: number | null; author: string | null }[];
}

/* ---------- Seguimiento ---------- */

export type FollowUpRow = {
  user_id: number; first_name: string; last_name: string; email: string; department: string | null;
  course_id: number | null; course: string | null; date: string | null;
};

export function followUps() {
  const db = getDb();
  const today = TODAY();
  const base = `SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.department, c.id AS course_id, c.title AS course`;
  const from = `FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id WHERE u.active = 1`;
  return {
    vencidos: db
      .prepare(`${base}, e.due_at AS date ${from} AND e.status <> 'completado' AND e.due_at < ? ORDER BY e.due_at`)
      .all(today) as FollowUpRow[],
    proximos: db
      .prepare(`${base}, e.due_at AS date ${from} AND e.status <> 'completado' AND e.due_at >= ? AND e.due_at <= date(?, '+7 days') ORDER BY e.due_at`)
      .all(today, today) as FollowUpRow[],
    sin_empezar: db
      .prepare(`${base}, e.enrolled_at AS date ${from} AND e.status = 'inscrito' AND e.enrolled_at < datetime('now', '-7 days') ORDER BY e.enrolled_at`)
      .all() as FollowUpRow[],
    estancados: db
      .prepare(`${base}, e.last_access_at AS date ${from} AND e.status = 'en_curso' AND e.last_access_at < datetime('now', '-14 days') ORDER BY e.last_access_at`)
      .all() as FollowUpRow[],
    sin_acceso: db
      .prepare(
        `SELECT u.id AS user_id, u.first_name, u.last_name, u.email, u.department, NULL AS course_id, NULL AS course, u.created_at AS date
         FROM users u WHERE u.active = 1 AND u.role = 'alumno' AND u.last_login_at IS NULL ORDER BY u.created_at`
      )
      .all() as FollowUpRow[],
  };
}

/* ---------- CSV ---------- */

/** Parser CSV tolerante: detecta ";" o ",", admite comillas y BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header.join(";"), ...rows.map((r) => r.map(csvCell).join(";"))].join("\r\n");
}

export const normalizeKey = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
