"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { clientIp, createSession, destroySession, getCurrentUser, logActivity } from "@/lib/auth";
import { clear, hit, tooMany } from "@/lib/rate-limit";
import { enroll, listCourses } from "@/lib/learning";
import { findInvitation, redeemInvitation } from "@/lib/students";
import { sendAccessLink } from "@/lib/notify";
import { mailEnabled } from "@/lib/mail";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  // Freno a la fuerza bruta: 5 fallos por email y 20 por IP cada 15 minutos.
  const ip = (await clientIp()) ?? "?";
  const keys = [`login:${email}`, `ip:${ip}`];
  if (tooMany(keys[0], 5, 15 * 60_000) || tooMany(keys[1], 20, 15 * 60_000))
    return { error: "Demasiados intentos. Espera unos minutos o recupera tu contraseña." };
  const user = getDb().prepare("SELECT id, password_hash, active FROM users WHERE email = ?").get(email) as
    | { id: number; password_hash: string; active: number }
    | undefined;
  if (user?.password_hash.startsWith("!"))
    return { error: "Tu cuenta aún no está activada. Usa el enlace de invitación que te ha enviado el equipo de formación." };
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    keys.forEach(hit);
    return { error: "Email o contraseña incorrectos." };
  }
  clear(keys[0]);
  if (!user.active) return { error: "Tu usuario está desactivado. Contacta con el equipo de formación." };
  getDb().prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  await createSession(user.id);
  await logActivity(user.id, "login");
  redirect("/inicio");
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const ipKey = `register:${(await clientIp()) ?? "?"}`;
  if (tooMany(ipKey, 10, 60 * 60_000)) return { error: "Demasiados registros desde esta conexión. Inténtalo más tarde." };
  hit(ipKey);
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

export async function activate(token: string, _: FormState, form: FormData): Promise<FormState> {
  const inv = findInvitation(token);
  if (!inv || inv.used_at || inv.expires_at < new Date().toISOString() || !inv.active)
    return { error: "El enlace no es válido o ha caducado. Pide uno nuevo al equipo de formación." };
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== String(form.get("password2") ?? "")) return { error: "Las contraseñas no coinciden." };
  if (!inv.consent_at && !form.get("consent")) return { error: "Debes aceptar el tratamiento de datos para la formación." };
  const userId = redeemInvitation(token, password)!;
  getDb().prepare("UPDATE users SET consent_at = COALESCE(consent_at, datetime('now')) WHERE id = ?").run(userId);
  await createSession(userId);
  await logActivity(userId, inv.kind === "reset" ? "password_restablecida" : "activacion");
  redirect("/inicio");
}

/** Siempre responde lo mismo, exista o no el email, para no revelar quién tiene cuenta. */
export async function forgotPassword(_: FormState, form: FormData): Promise<FormState> {
  if (!mailEnabled()) return { error: "La recuperación por email no está disponible. Contacta con formacion@tuio.com." };
  const ipKey = `forgot:${(await clientIp()) ?? "?"}`;
  if (tooMany(ipKey, 10, 60 * 60_000)) return { error: "Demasiadas solicitudes. Inténtalo más tarde." };
  hit(ipKey);
  const email = str(form, "email").toLowerCase();
  const u = getDb().prepare("SELECT id, active, password_hash FROM users WHERE email = ?").get(email) as
    | { id: number; active: number; password_hash: string }
    | undefined;
  if (u?.active) {
    const recent = getDb()
      .prepare("SELECT COUNT(*) AS n FROM email_log WHERE user_id = ? AND kind IN ('reset','invitacion') AND created_at > datetime('now', '-10 minutes')")
      .get(u.id) as { n: number };
    if (recent.n < 3) await sendAccessLink(u.id, null, u.password_hash.startsWith("!") ? "activacion" : "reset");
  }
  return { ok: "Si el email corresponde a una cuenta activa, recibirás un enlace en unos minutos. Revisa también la carpeta de spam." };
}
