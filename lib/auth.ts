import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { can, isStaff, type Permission, type Role } from "./permissions";

export type { Role };

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  nif: string | null;
  phone: string | null;
  company: string | null;
  department: string | null;
  job_title: string | null;
  role: Role;
  scope_departments: string | null;
  active: number;
  created_at: string;
  last_login_at: string | null;
};

const COOKIE = "tuio_session";
const SESSION_DAYS = 14;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(hash(token), userId, expires.toISOString());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash(token));
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const user = getDb()
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`
    )
    .get(hash(token), new Date().toISOString()) as (User & { password_hash?: string }) | undefined;
  if (!user) return null;
  delete user.password_hash;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  if (!isStaff(user)) redirect("/inicio");
  return user;
}

/** Exige un permiso concreto; si no lo tiene, vuelve al panel (o al inicio si no es del equipo). */
export async function requirePerm(perm: Permission): Promise<User> {
  const user = await requireUser();
  if (!can(user, perm)) redirect(isStaff(user) ? "/admin" : "/inicio");
  return user;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
}

export async function logActivity(
  userId: number,
  action: string,
  opts: { courseId?: number | null; unitId?: number | null; detail?: string | null } = {}
) {
  getDb()
    .prepare("INSERT INTO activity_log (user_id, course_id, unit_id, action, detail, ip) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, opts.courseId ?? null, opts.unitId ?? null, action, opts.detail ?? null, await clientIp());
}
