"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, logActivity } from "@/lib/auth";
import { enroll, listCourses } from "@/lib/learning";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = getDb().prepare("SELECT id, password_hash, active FROM users WHERE email = ?").get(email) as
    | { id: number; password_hash: string; active: number }
    | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return { error: "Email o contraseña incorrectos." };
  if (!user.active) return { error: "Tu usuario está desactivado. Contacta con el equipo de formación." };
  getDb().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  await createSession(user.id);
  await logActivity(user.id, "login");
  redirect("/inicio");
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const data = {
    first_name: str(form, "first_name"),
    last_name: str(form, "last_name"),
    email: str(form, "email").toLowerCase(),
    nif: str(form, "nif").toUpperCase() || null,
    phone: str(form, "phone") || null,
    company: str(form, "company") || "Tuio",
    department: str(form, "department") || null,
    job_title: str(form, "job_title") || null,
  };
  const password = String(form.get("password") ?? "");
  const password2 = String(form.get("password2") ?? "");

  if (!data.first_name || !data.last_name) return { error: "Indica tu nombre y apellidos." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return { error: "El email no es válido." };
  const domains = (process.env.ALLOWED_EMAIL_DOMAINS || "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (domains.length && !domains.includes(data.email.split("@")[1]))
    return { error: `Solo se admiten emails de: ${domains.join(", ")}` };
  if (data.nif && !/^[0-9XYZ][0-9]{7}[A-Z]$/.test(data.nif)) return { error: "El NIF/NIE no tiene un formato válido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== password2) return { error: "Las contraseñas no coinciden." };
  if (!form.get("consent")) return { error: "Debes aceptar la política de privacidad." };

  const db = getDb();
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(data.email)) return { error: "Ya existe una cuenta con ese email." };

  const id = Number(
    db
      .prepare(
        `INSERT INTO users (email, password_hash, first_name, last_name, nif, phone, company, department, job_title, consent_at, last_login_at)
         VALUES (@email, @hash, @first_name, @last_name, @nif, @phone, @company, @department, @job_title, datetime('now'), datetime('now'))`
      )
      .run({ ...data, hash: bcrypt.hashSync(password, 10) }).lastInsertRowid
  );
  // Matrícula automática en los cursos obligatorios.
  for (const c of listCourses({ publishedOnly: true }).filter((c) => c.mandatory)) enroll(id, c.id, id);

  await createSession(id);
  await logActivity(id, "registro");
  redirect("/inicio");
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await logActivity(user.id, "logout");
  await destroySession();
  redirect("/login");
}
