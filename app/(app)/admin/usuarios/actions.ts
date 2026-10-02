"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { logActivity, requirePerm } from "@/lib/auth";
import { assignableRoles, can, type Role } from "@/lib/permissions";
import { notifyEnrollment, remindEnrollments, sendAccessLink } from "@/lib/notify";
import { mailEnabled } from "@/lib/mail";
import { enroll, listCourses } from "@/lib/learning";
import { PENDING_HASH, addGroupMembers, canSeeStudent, listGroups, normalizeKey, parseCsv } from "@/lib/students";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NIF = /^[0-9XYZ][0-9]{7}[A-Z]$/;

function enrollMandatory(userId: number, by: number) {
  for (const c of listCourses({ publishedOnly: true }).filter((c) => c.mandatory)) enroll(userId, c.id, by);
}

/* ---------- Alta individual ---------- */

export type CreateState = { error?: string; created?: { id: number; name: string; email: string; link?: string; mailed?: string } } | undefined;

export async function createUser(_: CreateState, form: FormData): Promise<CreateState> {
  const staff = await requirePerm("alumnos.editar");
  const email = s(form, "email").toLowerCase();
  const password = s(form, "password");
  const wanted = s(form, "role") as Role;
  const role: Role = assignableRoles(staff).includes(wanted) ? wanted : "alumno";
  const nif = s(form, "nif").toUpperCase() || null;
  if (!s(form, "first_name") || !s(form, "last_name")) return { error: "Nombre y apellidos son obligatorios." };
  if (!EMAIL.test(email)) return { error: "Email no válido." };
  if (nif && !NIF.test(nif)) return { error: "El NIF/NIE no tiene un formato válido." };
  if (password && password.length < 8) return { error: "La contraseña inicial debe tener al menos 8 caracteres." };
  const db = getDb();
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return { error: "Ya existe un usuario con ese email." };

  const id = Number(
    db
      .prepare(
        `INSERT INTO users (email, password_hash, first_name, last_name, nif, phone, company, department, job_title, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(email, password ? bcrypt.hashSync(password, 10) : PENDING_HASH(), s(form, "first_name"), s(form, "last_name"), nif,
        s(form, "phone") || null, s(form, "company") || "Tuio", s(form, "department") || null, s(form, "job_title") || null, role)
      .lastInsertRowid
  );
  enrollMandatory(id, staff.id);
  const groupId = Number(form.get("group_id"));
  if (groupId) addGroupMembers(groupId, [id], staff.id);
  await logActivity(id, "alta_admin", { detail: `Por ${staff.first_name} ${staff.last_name}` });
  revalidatePath("/admin/usuarios");
  const created = { id, name: `${s(form, "first_name")} ${s(form, "last_name")}`, email } as NonNullable<CreateState>["created"] & {};
  if (!password) {
    const r = await sendAccessLink(id, staff.id);
    created.link = r.link;
    created.mailed = r.mail ? (r.mail.ok ? "Invitación enviada por email." : `No se pudo enviar el email: ${r.mail.error}`) : undefined;
  }
  return { created };
}

/* ---------- Invitaciones ---------- */

export type InviteState = { link?: string; error?: string; mailed?: string } | undefined;

export async function generateInvite(userId: number): Promise<InviteState> {
  const staff = await requirePerm("seguimiento.gestionar");
  if (!canSeeStudent(staff, userId)) return { error: "Fuera de tu ámbito." };
  const u = getDb().prepare("SELECT active FROM users WHERE id = ?").get(userId) as { active: number } | undefined;
  if (!u) return { error: "Usuario no encontrado." };
  if (!u.active) return { error: "El usuario está desactivado." };
  const { link, mail } = await sendAccessLink(userId, staff.id);
  await logActivity(userId, "invitacion", { detail: `Por ${staff.first_name} ${staff.last_name}${mail?.ok ? " · enviada por email" : ""}` });
  revalidatePath(`/admin/usuarios/${userId}`);
  return { link, mailed: mail ? (mail.ok ? "Enviada por email al alumno." : `No se pudo enviar el email: ${mail.error}`) : undefined };
}

/* ---------- Acciones en bloque ---------- */

export type BulkState = { ok?: string; error?: string; links?: { name: string; email: string; link: string }[] } | undefined;

export async function bulkUsers(_: BulkState, form: FormData): Promise<BulkState> {
  const staff = await requirePerm("alumnos.ver");
  const action = s(form, "bulk_action");
  const ids = form.getAll("ids").map(Number).filter((id) => id && canSeeStudent(staff, id));
  if (!ids.length) return { error: "Selecciona al menos un usuario." };
  const db = getDb();
  const courseId = Number(form.get("bulk_course"));
  const groupId = Number(form.get("bulk_group"));
  const need: Record<string, Parameters<typeof can>[1]> = {
    inscribir: "inscripciones.gestionar", baja: "inscripciones.baja", grupo: "grupos.gestionar", activar: "alumnos.desactivar",
    desactivar: "alumnos.desactivar", invitar: "seguimiento.gestionar", recordar: "seguimiento.gestionar",
  };
  if (need[action] && !can(staff, need[action])) return { error: "No tienes permiso para esta acción." };

  switch (action) {
    case "inscribir": {
      if (!courseId) return { error: "Elige el curso." };
      const due = s(form, "bulk_due") || null;
      let mailed = 0;
      for (const id of ids) {
        enroll(id, courseId, staff.id, due);
        await logActivity(id, "inscripcion_admin", { courseId, detail: `Por ${staff.first_name} ${staff.last_name}` });
        if (form.get("bulk_notify") && (await notifyEnrollment(id, [courseId], due, staff.id))?.ok) mailed++;
      }
      revalidatePath("/admin/usuarios");
      return { ok: `${ids.length} inscrito(s)${mailed ? ` · ${mailed} aviso(s) por email` : ""}.` };
    }
    case "baja": {
      if (!courseId) return { error: "Elige el curso." };
      const del = db.prepare("DELETE FROM enrollments WHERE user_id = ? AND course_id = ?");
      for (const id of ids) if (del.run(id, courseId).changes) await logActivity(id, "baja_admin", { courseId });
      break;
    }
    case "grupo": {
      if (!groupId) return { error: "Elige el grupo." };
      const n = addGroupMembers(groupId, ids, staff.id);
      for (const id of ids) await logActivity(id, "grupo_alta", { detail: listGroups().find((g) => g.id === groupId)?.name });
      revalidatePath("/admin/usuarios");
      return { ok: `${n} usuario(s) añadidos al grupo e inscritos en sus cursos.` };
    }
    case "activar":
    case "desactivar": {
      const active = action === "activar" ? 1 : 0;
      const allowed = assignableRoles(staff);
      const targets = ids.filter((id) => {
        const r = (db.prepare("SELECT role FROM users WHERE id = ?").get(id) as { role: Role }).role;
        return id !== staff.id && (allowed.includes(r) || staff.role === "superadmin") && r !== "superadmin";
      });
      const upd = db.prepare("UPDATE users SET active = ? WHERE id = ?");
      for (const id of targets) {
        upd.run(active, id);
        if (!active) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
        await logActivity(id, active ? "usuario_activado" : "usuario_desactivado");
      }
      break;
    }
    case "invitar": {
      const rows = db
        .prepare(`SELECT id, first_name, last_name, email FROM users WHERE active = 1 AND password_hash LIKE '!%' AND id IN (${ids.map(() => "?").join(",")})`)
        .all(...ids) as { id: number; first_name: string; last_name: string; email: string }[];
      if (!rows.length) return { error: "Ninguno de los seleccionados está pendiente de activar su cuenta." };
      const links = [];
      let mailed = 0;
      for (const r of rows) {
        const res = await sendAccessLink(r.id, staff.id);
        if (res.mail?.ok) mailed++;
        links.push({ name: `${r.first_name} ${r.last_name}`, email: r.email, link: res.link });
        await logActivity(r.id, "invitacion", { detail: res.mail?.ok ? "Enviada por email" : null });
      }
      return {
        ok: mailEnabled() ? `${mailed} de ${links.length} invitación(es) enviadas por email.` : `${links.length} enlace(s) de activación generados.`,
        links: mailEnabled() && mailed === links.length ? [] : links,
      };
    }
    case "recordar": {
      const enr = (db
        .prepare(`SELECT id FROM enrollments WHERE status <> 'completado' AND user_id IN (${ids.map(() => "?").join(",")})`)
        .all(...ids) as { id: number }[]).map((r) => r.id);
      const r = await remindEnrollments(enr, "manual", staff.id);
      if (r.notConfigured) return { error: "El envío de correo no está configurado." };
      return { ok: `Recordatorio enviado a ${r.sent} alumno(s)${r.failed ? ` · ${r.failed} fallido(s)` : ""}.` };
    }
    default:
      return { error: "Elige una acción." };
  }
  revalidatePath("/admin/usuarios");
  return { ok: `Acción aplicada a ${ids.length} usuario(s).` };
}

/* ---------- Importación CSV ---------- */

export type ImportRow = {
  line: number; email: string; name: string; result: "creado" | "actualizado" | "omitido" | "error"; message?: string; link?: string; mailed?: boolean;
};

const ROLE_ALIASES: Record<string, Role> = {
  alumno: "alumno", alumna: "alumno", tutor: "tutor", tutora: "tutor", seguimiento: "tutor", admin: "admin",
  administracion: "admin", administrador: "admin", superadmin: "superadmin", superadministracion: "superadmin",
};
export type ImportState = { rows?: ImportRow[]; error?: string } | undefined;

const COLUMN_ALIASES: Record<string, string> = {
  nombre: "first_name", apellidos: "last_name", apellido: "last_name", email: "email", correo: "email", correoelectronico: "email",
  nif: "nif", dni: "nif", nie: "nif", nifnie: "nif", telefono: "phone", movil: "phone", empresa: "company",
  departamento: "department", area: "department", puesto: "job_title", cargo: "job_title", rol: "role",
  cursos: "courses", curso: "courses", grupo: "group", convocatoria: "group", fechalimite: "due",
};

export async function importUsers(_: ImportState, form: FormData): Promise<ImportState> {
  const staff = await requirePerm("alumnos.editar");
  const file = form.get("file");
  let text = s(form, "text");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2_000_000) return { error: "El fichero supera 2 MB." };
    text = await file.text();
  }
  if (!text) return { error: "Sube un fichero CSV o pega el contenido." };
  const update = !!form.get("update");
  const invite = !!form.get("invite");

  const table = parseCsv(text);
  if (table.length < 2) return { error: "El CSV no tiene filas de datos." };
  const cols = table[0].map((h) => COLUMN_ALIASES[normalizeKey(h)] ?? null);
  for (const req of ["first_name", "last_name", "email"]) {
    if (!cols.includes(req)) return { error: `Falta la columna obligatoria «${{ first_name: "nombre", last_name: "apellidos", email: "email" }[req]}».` };
  }

  const db = getDb();
  const courses = listCourses();
  const findCourse = (ref: string) => {
    const k = ref.trim().toLowerCase();
    return courses.find((c) => String(c.id) === k || c.slug === k || c.title.toLowerCase() === k);
  };
  const groups = listGroups();
  const out: ImportRow[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < table.length; i++) {
    const rec: Record<string, string> = {};
    table[i].forEach((v, j) => { if (cols[j]) rec[cols[j]!] = v.trim(); });
    const email = (rec.email ?? "").toLowerCase();
    const name = `${rec.first_name ?? ""} ${rec.last_name ?? ""}`.trim();
    const row: ImportRow = { line: i + 1, email, name, result: "error" };
    out.push(row);

    if (!EMAIL.test(email)) { row.message = "Email no válido"; continue; }
    if (seen.has(email)) { row.message = "Email repetido en el fichero"; continue; }
    seen.add(email);
    if (!rec.first_name || !rec.last_name) { row.message = "Faltan nombre o apellidos"; continue; }
    const nif = rec.nif ? rec.nif.toUpperCase().replace(/[\s-]/g, "") : null;
    if (nif && !NIF.test(nif)) { row.message = `NIF/NIE no válido (${rec.nif})`; continue; }
    const role = (ROLE_ALIASES[normalizeKey(rec.role ?? "")] ?? (rec.role ? null : "alumno")) as Role | null;
    if (!role) { row.message = `Rol desconocido (${rec.role})`; continue; }
    if (!assignableRoles(staff).includes(role)) { row.message = `No puedes asignar el rol «${rec.role}»`; continue; }
    const courseRefs = (rec.courses ?? "").split(/[|,]/).map((x) => x.trim()).filter(Boolean);
    const courseIds: number[] = [];
    const unknown = courseRefs.filter((r) => { const c = findCourse(r); if (c) courseIds.push(c.id); return !c; });
    if (unknown.length) { row.message = `Curso no encontrado: ${unknown.join(", ")}`; continue; }
    const group = rec.group ? groups.find((g) => g.name.toLowerCase() === rec.group.toLowerCase()) : undefined;
    if (rec.group && !group) { row.message = `Grupo no encontrado: ${rec.group}`; continue; }
    const due = rec.due ? toIsoDate(rec.due) : null;
    if (rec.due && !due) { row.message = `Fecha límite no válida (${rec.due}); usa dd/mm/aaaa`; continue; }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
    let id: number;
    if (existing) {
      if (!update) { row.result = "omitido"; row.message = "Ya existe (marca «actualizar existentes» para modificarlo)"; continue; }
      id = existing.id;
      db.prepare(
        `UPDATE users SET first_name = ?, last_name = ?, nif = COALESCE(?, nif), phone = COALESCE(?, phone),
         company = COALESCE(?, company), department = COALESCE(?, department), job_title = COALESCE(?, job_title),
         role = COALESCE(?, role) WHERE id = ?`
      ).run(rec.first_name, rec.last_name, nif, rec.phone || null, rec.company || null, rec.department || null,
        rec.job_title || null, rec.role ? role : null, id);
      row.result = "actualizado";
    } else {
      id = Number(
        db
          .prepare(
            `INSERT INTO users (email, password_hash, first_name, last_name, nif, phone, company, department, job_title, role)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(email, PENDING_HASH(), rec.first_name, rec.last_name, nif, rec.phone || null, rec.company || "Tuio",
            rec.department || null, rec.job_title || null, role).lastInsertRowid
      );
      enrollMandatory(id, staff.id);
      await logActivity(id, "importacion", { detail: `Por ${staff.first_name} ${staff.last_name}` });
      row.result = "creado";
      if (invite) {
        const r = await sendAccessLink(id, staff.id);
        row.link = r.link;
        row.mailed = r.mail?.ok;
      }
    }
    for (const c of courseIds) enroll(id, c, staff.id, due);
    if (group) addGroupMembers(group.id, [id], staff.id);
    if (courseIds.length || group) row.message = [courseIds.length && `${courseIds.length} curso(s)`, group && `grupo ${group.name}`].filter(Boolean).join(" · ");
  }
  revalidatePath("/admin/usuarios");
  return { rows: out };
}

/** Acepta dd/mm/aaaa, d/m/aa o aaaa-mm-dd. */
function toIsoDate(v: string): string | null {
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return v;
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? "20" + m[3] : m[3];
  const iso = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isNaN(Date.parse(iso)) ? null : iso;
}

/* ---------- Ficha: notas y fechas límite ---------- */

export async function addNote(userId: number, form: FormData) {
  const staff = await requirePerm("seguimiento.gestionar");
  if (!canSeeStudent(staff, userId)) return;
  const body = s(form, "body");
  if (!body) return;
  getDb().prepare("INSERT INTO user_notes (user_id, author_id, body) VALUES (?, ?, ?)").run(userId, staff.id, body.slice(0, 4000));
  revalidatePath(`/admin/usuarios/${userId}`);
}

export async function deleteNote(userId: number, noteId: number) {
  const staff = await requirePerm("seguimiento.gestionar");
  const note = getDb().prepare("SELECT author_id FROM user_notes WHERE id = ? AND user_id = ?").get(noteId, userId) as { author_id: number } | undefined;
  if (!note || (note.author_id !== staff.id && !can(staff, "alumnos.editar"))) return;
  getDb().prepare("DELETE FROM user_notes WHERE id = ?").run(noteId);
  revalidatePath(`/admin/usuarios/${userId}`);
}

export async function setDueDate(userId: number, courseId: number, form: FormData) {
  const staff = await requirePerm("seguimiento.gestionar");
  if (!canSeeStudent(staff, userId)) return;
  const due = s(form, "due") || null;
  getDb().prepare("UPDATE enrollments SET due_at = ? WHERE user_id = ? AND course_id = ?").run(due, userId, courseId);
  await logActivity(userId, "fecha_limite", { courseId, detail: due ? `Hasta ${due.split("-").reverse().join("/")}` : "Sin fecha límite" });
  revalidatePath(`/admin/usuarios/${userId}`);
}

export async function deleteUser(userId: number) {
  const admin = await requirePerm("alumnos.eliminar");
  if (userId === admin.id) return;
  const t = getDb().prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: Role } | undefined;
  if (t?.role === "superadmin" && (getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'").get() as { n: number }).n <= 1) return;
  getDb().prepare("DELETE FROM users WHERE id = ?").run(userId);
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function addUserToGroup(userId: number, form: FormData) {
  const staff = await requirePerm("grupos.gestionar");
  const groupId = Number(form.get("group_id"));
  if (!groupId) return;
  addGroupMembers(groupId, [userId], staff.id);
  await logActivity(userId, "grupo_alta", { detail: listGroups().find((g) => g.id === groupId)?.name });
  revalidatePath(`/admin/usuarios/${userId}`);
}
