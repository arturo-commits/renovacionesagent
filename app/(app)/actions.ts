"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { logActivity, requireUser } from "@/lib/auth";
import { notifyCompletion } from "@/lib/notify";
import {
  completeUnit, enroll, getCourse, getEnrollment, getUnitWithCourse, parseQuiz,
} from "@/lib/learning";

export async function enrollSelf(courseId: number) {
  const user = await requireUser();
  const course = getCourse(courseId);
  if (!course || !course.published) redirect("/catalogo");
  enroll(user.id, courseId, user.id);
  await logActivity(user.id, "inscripcion", { courseId });
  revalidatePath("/", "layout");
  redirect(`/cursos/${courseId}`);
}

export async function markComplete(unitId: number) {
  const user = await requireUser();
  const unit = getUnitWithCourse(unitId);
  if (!unit || unit.type === "test") return;
  const enrollment = getEnrollment(user.id, unit.course_id);
  if (!enrollment) return;
  const finished = completeUnit(enrollment, unitId);
  await logActivity(user.id, "unidad_completada", { courseId: unit.course_id, unitId });
  if (finished) {
    await logActivity(user.id, "curso_completado", { courseId: unit.course_id });
    await notifyCompletion(user.id, enrollment.id);
  }
  revalidatePath(`/cursos/${unit.course_id}`, "layout");
}

export type QuizResult = { score: number; passed: boolean; correct: number[]; answers: (number | null)[] } | undefined;

export async function submitQuiz(unitId: number, _: QuizResult, form: FormData): Promise<QuizResult> {
  const user = await requireUser();
  const unit = getUnitWithCourse(unitId);
  if (!unit || unit.type !== "test") return;
  const enrollment = getEnrollment(user.id, unit.course_id);
  const course = getCourse(unit.course_id);
  if (!enrollment || !course) return;

  const questions = parseQuiz(unit);
  const answers = questions.map((_, i) => {
    const v = form.get(`q${i}`);
    return v == null ? null : Number(v);
  });
  const hits = questions.filter((q, i) => answers[i] === q.correct).length;
  const score = questions.length ? Math.round((hits / questions.length) * 100) : 0;
  const passed = score >= course.passing_score;

  getDb()
    .prepare("INSERT INTO quiz_attempts (enrollment_id, unit_id, score, passed, answers_json) VALUES (?, ?, ?, ?, ?)")
    .run(enrollment.id, unitId, score, passed ? 1 : 0, JSON.stringify(answers));
  await logActivity(user.id, "test_enviado", { courseId: unit.course_id, unitId, detail: `Nota ${score}/100 · ${passed ? "Apto" : "No apto"}` });
  if (passed) {
    const finished = completeUnit(enrollment, unitId);
    if (finished) {
      await logActivity(user.id, "curso_completado", { courseId: unit.course_id });
      await notifyCompletion(user.id, enrollment.id);
    }
  }
  revalidatePath(`/cursos/${unit.course_id}`, "layout");
  return { score, passed, correct: questions.map((q) => q.correct), answers };
}

export type ProfileState = { error?: string; ok?: string } | undefined;

export async function updateProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const s = (k: string) => String(form.get(k) ?? "").trim() || null;
  const nif = s("nif")?.toUpperCase() ?? null;
  if (!s("first_name") || !s("last_name")) return { error: "Nombre y apellidos son obligatorios." };
  if (nif && !/^[0-9XYZ][0-9]{7}[A-Z]$/.test(nif)) return { error: "El NIF/NIE no tiene un formato válido." };
  getDb()
    .prepare(
      `UPDATE users SET first_name = ?, last_name = ?, nif = ?, phone = ?, company = ?, department = ?, job_title = ? WHERE id = ?`
    )
    .run(s("first_name"), s("last_name"), nif, s("phone"), s("company"), s("department"), s("job_title"), user.id);
  await logActivity(user.id, "perfil_actualizado");
  revalidatePath("/", "layout");
  return { ok: "Datos guardados." };
}

export async function changePassword(_: ProfileState, form: FormData): Promise<ProfileState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const row = getDb().prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as { password_hash: string };
  if (!bcrypt.compareSync(current, row.password_hash)) return { error: "La contraseña actual no es correcta." };
  if (next.length < 8) return { error: "La nueva contraseña debe tener al menos 8 caracteres." };
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(next, 10), user.id);
  await logActivity(user.id, "password_cambiada");
  return { ok: "Contraseña actualizada." };
}
