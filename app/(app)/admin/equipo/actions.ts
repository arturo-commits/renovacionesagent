"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { logActivity, requirePerm } from "@/lib/auth";
import { ROLE_LABEL, assignableRoles, type Role } from "@/lib/permissions";
import { sendAccessLink } from "@/lib/notify";
import { PENDING_HASH } from "@/lib/students";

export type TeamState = { ok?: string; error?: string } | undefined;

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Da un rol de gestión a un usuario existente o crea la cuenta y le envía la invitación. */
export async function addTeamMember(_: TeamState, form: FormData): Promise<TeamState> {
  const staff = await requirePerm("alumnos.editar");
  const email = s(form, "email").toLowerCase();
  const role = s(form, "role") as Role;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email no válido." };
  if (role === "alumno" || !assignableRoles(staff).includes(role)) return { error: "No puedes asignar ese rol." };
  const scope = role === "tutor" ? form.getAll("scope").map(String).filter(Boolean).join("|") || null : null;
  const db = getDb();
  const existing = db.prepare("SELECT id, role FROM users WHERE email = ?").get(email) as { id: number; role: Role } | undefined;

  if (existing) {
    if (!assignableRoles(staff).includes(existing.role)) return { error: "Ese usuario ya tiene un rol que no puedes modificar." };
    db.prepare("UPDATE users SET role = ?, scope_departments = ?, active = 1 WHERE id = ?").run(role, scope, existing.id);
    await logActivity(existing.id, "rol_cambiado", { detail: `${ROLE_LABEL[existing.role]} → ${ROLE_LABEL[role]} · por ${staff.first_name} ${staff.last_name}` });
    revalidatePath("/admin/equipo");
    return { ok: `${email} ahora tiene el rol «${ROLE_LABEL[role]}».` };
  }
  const first = s(form, "first_name");
  const last = s(form, "last_name");
  if (!first || !last) return { error: "No existe ningún usuario con ese email: indica nombre y apellidos para crearlo." };
  const id = Number(
    db
      .prepare(
        `INSERT INTO users (email, password_hash, first_name, last_name, company, department, role, scope_departments)
         VALUES (?, ?, ?, ?, 'Tuio', ?, ?, ?)`
      )
      .run(email, PENDING_HASH(), first, last, s(form, "department") || null, role, scope).lastInsertRowid
  );
  await logActivity(id, "alta_admin", { detail: `${ROLE_LABEL[role]} · por ${staff.first_name} ${staff.last_name}` });
  const { mail } = await sendAccessLink(id, staff.id);
  revalidatePath("/admin/equipo");
  return {
    ok: `Cuenta creada con el rol «${ROLE_LABEL[role]}». ${mail?.ok ? "Se le ha enviado la invitación por email." : "Envíale la invitación desde su ficha."}`,
  };
}

export async function removeFromTeam(userId: number) {
  const staff = await requirePerm("alumnos.editar");
  if (userId === staff.id) return;
  const db = getDb();
  const u = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: Role } | undefined;
  if (!u || !assignableRoles(staff).includes(u.role)) return;
  if (u.role === "superadmin" && (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin' AND active = 1").get() as { n: number }).n <= 1) return;
  db.prepare("UPDATE users SET role = 'alumno', scope_departments = NULL WHERE id = ?").run(userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  await logActivity(userId, "rol_cambiado", { detail: `${ROLE_LABEL[u.role]} → ${ROLE_LABEL.alumno} · por ${staff.first_name} ${staff.last_name}` });
  revalidatePath("/admin/equipo");
}
