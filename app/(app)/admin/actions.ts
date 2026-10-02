"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { logActivity, requireAdmin, requireStaff } from "@/lib/auth";
import { enroll } from "@/lib/learning";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string) => Number(f.get(k));

export type AdminState = { error?: string; ok?: string } | undefined;

/* ---------- Usuarios ---------- */

export async function createUser(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireStaff();
  const email = s(form, "email").toLowerCase();
  const password = s(form, "password");
  const role = admin.role === "admin" ? s(form, "role") || "alumno" : "alumno";
  if (!s(form, "first_name") || !s(form, "last_name")) return { error: "Nombre y apellidos son obligatorios." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email no válido." };
  if (password.length < 8) return { error: "La contraseña inicial debe tener al menos 8 caracteres." };
  const db = getDb();
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return { error: "Ya existe un usuario con ese email." };
  const id = Number(
    db
      .prepare(
        `INSERT INTO users (email, password_hash, first_name, last_name, company, department, job_title, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(email, bcrypt.hashSync(password, 10), s(form, "first_name"), s(form, "last_name"), s(form, "company") || "Tuio",
        s(form, "department") || null, s(form, "job_title") || null, role).lastInsertRowid
  );
  const mandatory = db.prepare("SELECT id FROM courses WHERE mandatory = 1 AND published = 1").all() as { id: number }[];
  for (const c of mandatory) enroll(id, c.id, admin.id);
  revalidatePath("/admin/usuarios");
  redirect(`/admin/usuarios/${id}`);
}

export async function updateUser(userId: number, _: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const role = s(form, "role");
  const active = form.get("active") ? 1 : 0;
  if (userId === admin.id && (role !== "admin" || !active)) return { error: "No puedes quitarte el rol de administración ni desactivarte." };
  getDb()
    .prepare("UPDATE users SET first_name = ?, last_name = ?, nif = ?, company = ?, department = ?, job_title = ?, role = ?, active = ? WHERE id = ?")
    .run(s(form, "first_name"), s(form, "last_name"), s(form, "nif").toUpperCase() || null, s(form, "company") || null,
      s(form, "department") || null, s(form, "job_title") || null, role, active, userId);
  if (!active) getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  revalidatePath(`/admin/usuarios/${userId}`);
  return { ok: "Usuario actualizado." };
}

export async function resetPassword(userId: number, _: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const password = s(form, "password");
  if (password.length < 8) return { error: "Mínimo 8 caracteres." };
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), userId);
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return { ok: "Contraseña restablecida. Comunícasela al usuario." };
}

export async function enrollUser(userId: number, form: FormData) {
  const staff = await requireStaff();
  const courseId = n(form, "course_id");
  if (!courseId) return;
  enroll(userId, courseId, staff.id);
  await logActivity(userId, "inscripcion_admin", { courseId, detail: `Por ${staff.first_name} ${staff.last_name}` });
  revalidatePath(`/admin/usuarios/${userId}`);
}

export async function unenrollUser(userId: number, courseId: number) {
  const staff = await requireAdmin();
  getDb().prepare("DELETE FROM enrollments WHERE user_id = ? AND course_id = ?").run(userId, courseId);
  await logActivity(userId, "baja_admin", { courseId, detail: `Por ${staff.first_name} ${staff.last_name}` });
  revalidatePath(`/admin/usuarios/${userId}`);
}

/** Inscripción masiva: todos los usuarios activos de un departamento (o todos) en un curso. */
export async function bulkEnroll(courseId: number, form: FormData) {
  const staff = await requireStaff();
  const dept = s(form, "department");
  const users = getDb()
    .prepare(`SELECT id FROM users WHERE active = 1 ${dept ? "AND department = ?" : ""}`)
    .all(...(dept ? [dept] : [])) as { id: number }[];
  for (const u of users) enroll(u.id, courseId, staff.id);
  revalidatePath(`/admin/cursos/${courseId}`);
}

/* ---------- Cursos ---------- */

export async function createCourse(form: FormData) {
  await requireAdmin();
  const title = s(form, "title") || "Nuevo curso";
  const slug = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
  const id = getDb()
    .prepare("INSERT INTO courses (slug, title, product, published) VALUES (?, ?, ?, 0)")
    .run(slug, title, s(form, "product") || "general").lastInsertRowid;
  redirect(`/admin/cursos/${id}`);
}

export async function updateCourse(courseId: number, _: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const passing = Math.min(100, Math.max(0, n(form, "passing_score") || 0));
  getDb()
    .prepare(
      `UPDATE courses SET title = ?, subtitle = ?, description = ?, product = ?, hours = ?, modality = ?, passing_score = ?,
       mandatory = ?, published = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .run(s(form, "title"), s(form, "subtitle") || null, s(form, "description") || null, s(form, "product"), n(form, "hours") || 1,
      s(form, "modality") || "Online", passing, form.get("mandatory") ? 1 : 0, form.get("published") ? 1 : 0, courseId);
  revalidatePath("/", "layout");
  return { ok: "Curso guardado." };
}

export async function deleteCourse(courseId: number) {
  await requireAdmin();
  getDb().prepare("DELETE FROM courses WHERE id = ?").run(courseId);
  revalidatePath("/", "layout");
  redirect("/admin/cursos");
}

export async function addModule(courseId: number, form: FormData) {
  await requireAdmin();
  const db = getDb();
  const { p } = db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM modules WHERE course_id = ?").get(courseId) as { p: number };
  db.prepare("INSERT INTO modules (course_id, position, title) VALUES (?, ?, ?)").run(courseId, p, s(form, "title") || `Módulo ${p}`);
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function renameModule(courseId: number, moduleId: number, form: FormData) {
  await requireAdmin();
  getDb().prepare("UPDATE modules SET title = ? WHERE id = ? AND course_id = ?").run(s(form, "title"), moduleId, courseId);
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function deleteModule(courseId: number, moduleId: number) {
  await requireAdmin();
  getDb().prepare("DELETE FROM modules WHERE id = ? AND course_id = ?").run(moduleId, courseId);
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function moveModule(courseId: number, moduleId: number, dir: -1 | 1) {
  await requireAdmin();
  swapPositions("modules", "course_id", courseId, moduleId, dir);
  revalidatePath(`/admin/cursos/${courseId}`);
}

export async function addUnit(courseId: number, moduleId: number, form: FormData) {
  await requireAdmin();
  const db = getDb();
  const type = s(form, "type") || "lectura";
  const { p } = db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM units WHERE module_id = ?").get(moduleId) as { p: number };
  const id = db
    .prepare("INSERT INTO units (module_id, position, title, type, content, quiz_json) VALUES (?, ?, ?, ?, ?, ?)")
    .run(moduleId, p, s(form, "title") || "Nueva unidad", type, "Contenido pendiente de incorporar.", type === "test" ? "[]" : null)
    .lastInsertRowid;
  redirect(`/admin/cursos/${courseId}?unidad=${id}#unidad`);
}

export async function updateUnit(courseId: number, unitId: number, _: AdminState, form: FormData): Promise<AdminState> {
  await requireAdmin();
  const quiz = s(form, "quiz_json");
  if (quiz) {
    try {
      const parsed = JSON.parse(quiz);
      if (!Array.isArray(parsed) || parsed.some((q) => typeof q.q !== "string" || !Array.isArray(q.options) || typeof q.correct !== "number"))
        throw new Error();
    } catch {
      return { error: 'El JSON del test no es válido. Formato: [{"q": "Pregunta", "options": ["A", "B"], "correct": 0}]' };
    }
  }
  getDb()
    .prepare("UPDATE units SET title = ?, type = ?, duration_min = ?, resource_url = ?, content = ?, quiz_json = ? WHERE id = ?")
    .run(s(form, "title"), s(form, "type"), n(form, "duration_min") || 10, s(form, "resource_url") || null,
      String(form.get("content") ?? ""), quiz || null, unitId);
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/cursos/${courseId}`, "layout");
  return { ok: "Unidad guardada." };
}

export async function deleteUnit(courseId: number, unitId: number) {
  await requireAdmin();
  getDb().prepare("DELETE FROM units WHERE id = ?").run(unitId);
  revalidatePath(`/admin/cursos/${courseId}`);
  redirect(`/admin/cursos/${courseId}`);
}

export async function moveUnit(courseId: number, moduleId: number, unitId: number, dir: -1 | 1) {
  await requireAdmin();
  swapPositions("units", "module_id", moduleId, unitId, dir);
  revalidatePath(`/admin/cursos/${courseId}`);
}

function swapPositions(table: "modules" | "units", parentCol: string, parentId: number, id: number, dir: -1 | 1) {
  const db = getDb();
  const rows = db.prepare(`SELECT id FROM ${table} WHERE ${parentCol} = ? ORDER BY position, id`).all(parentId) as { id: number }[];
  const i = rows.findIndex((r) => r.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  const upd = db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
  db.transaction(() => rows.forEach((r, k) => upd.run(k + 1, r.id)))();
}
