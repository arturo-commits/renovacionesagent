"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { logActivity, requireStaff } from "@/lib/auth";
import { addGroupCourse, addGroupMembers, getGroup } from "@/lib/students";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createGroup(form: FormData) {
  const staff = await requireStaff();
  const name = s(form, "name");
  if (!name) return;
  const id = getDb()
    .prepare("INSERT INTO groups (name, start_date, end_date, tutor_id) VALUES (?, ?, ?, ?)")
    .run(name, s(form, "start_date") || null, s(form, "end_date") || null, staff.id).lastInsertRowid;
  redirect(`/admin/grupos/${id}`);
}

export type GroupState = { ok?: string; error?: string } | undefined;

export async function updateGroup(groupId: number, _: GroupState, form: FormData): Promise<GroupState> {
  await requireStaff();
  const start = s(form, "start_date") || null;
  const end = s(form, "end_date") || null;
  if (start && end && end < start) return { error: "La fecha de fin es anterior a la de inicio." };
  const db = getDb();
  db.prepare("UPDATE groups SET name = ?, description = ?, tutor_id = ?, start_date = ?, end_date = ? WHERE id = ?").run(
    s(form, "name"), s(form, "description") || null, Number(form.get("tutor_id")) || null, start, end, groupId
  );
  if (form.get("apply_due") && end) {
    db.prepare(
      `UPDATE enrollments SET due_at = ? WHERE status <> 'completado'
       AND user_id IN (SELECT user_id FROM group_members WHERE group_id = ?)
       AND course_id IN (SELECT course_id FROM group_courses WHERE group_id = ?)`
    ).run(end, groupId, groupId);
  }
  revalidatePath(`/admin/grupos/${groupId}`);
  return { ok: "Grupo guardado." };
}

export async function deleteGroup(groupId: number) {
  await requireStaff();
  getDb().prepare("DELETE FROM groups WHERE id = ?").run(groupId);
  redirect("/admin/grupos");
}

export async function addCourseToGroup(groupId: number, form: FormData) {
  const staff = await requireStaff();
  const courseId = Number(form.get("course_id"));
  if (courseId) addGroupCourse(groupId, courseId, staff.id);
  revalidatePath(`/admin/grupos/${groupId}`);
}

export async function removeCourseFromGroup(groupId: number, courseId: number) {
  await requireStaff();
  getDb().prepare("DELETE FROM group_courses WHERE group_id = ? AND course_id = ?").run(groupId, courseId);
  revalidatePath(`/admin/grupos/${groupId}`);
}

export async function addMembers(groupId: number, form: FormData) {
  const staff = await requireStaff();
  const db = getDb();
  let ids = form.getAll("user_id").map(Number).filter(Boolean);
  const dept = s(form, "department");
  if (dept) ids = ids.concat((db.prepare("SELECT id FROM users WHERE active = 1 AND department = ?").all(dept) as { id: number }[]).map((r) => r.id));
  const emails = s(form, "emails").split(/[\s,;]+/).map((e) => e.toLowerCase()).filter(Boolean);
  for (const e of emails) {
    const u = db.prepare("SELECT id FROM users WHERE email = ?").get(e) as { id: number } | undefined;
    if (u) ids.push(u.id);
  }
  ids = [...new Set(ids)];
  addGroupMembers(groupId, ids, staff.id);
  const name = getGroup(groupId)?.name;
  for (const id of ids) await logActivity(id, "grupo_alta", { detail: name });
  revalidatePath(`/admin/grupos/${groupId}`);
}

export async function removeMember(groupId: number, userId: number) {
  await requireStaff();
  getDb().prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(groupId, userId);
  await logActivity(userId, "grupo_baja", { detail: getGroup(groupId)?.name });
  revalidatePath(`/admin/grupos/${groupId}`);
}
