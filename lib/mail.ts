import "server-only";
import fs from "node:fs";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { getDb } from "./db";

/**
 * Envío de correo desde la cuenta de formación (por defecto formacion@tuio.com).
 *
 * MAIL_TRANSPORT:
 *  - "smtp" (por defecto si hay SMTP_HOST): envía de verdad.
 *  - "log": no envía; guarda cada mensaje como .eml en data/outbox (pruebas y desarrollo).
 *  - sin configurar: no se envía nada y queda anotado en el registro.
 */

export type MailMode = "smtp" | "log" | "off";

export function mailConfig() {
  const mode: MailMode =
    (process.env.MAIL_TRANSPORT as MailMode) || (process.env.SMTP_HOST ? "smtp" : "off");
  const port = Number(process.env.SMTP_PORT) || 587;
  return {
    mode,
    host: process.env.SMTP_HOST ?? "",
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    user: process.env.SMTP_USER ?? "",
    hasPassword: !!process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || "Tuio Academy <formacion@tuio.com>",
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  };
}

export const mailEnabled = () => mailConfig().mode !== "off";

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  const c = mailConfig();
  if (c.mode === "off") return null;
  if (transporter) return transporter;
  transporter =
    c.mode === "log"
      ? nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" })
      : nodemailer.createTransport({
          host: c.host,
          port: c.port,
          secure: c.secure,
          auth: c.user ? { user: c.user, pass: process.env.SMTP_PASS } : undefined,
          pool: true,
          maxConnections: 3,
        });
  return transporter;
}

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: string;
  userId?: number | null;
  sentBy?: number | null;
};

export type MailResult = { ok: boolean; status: "enviado" | "simulado" | "error" | "sin_configurar"; error?: string };

export async function sendMail(m: MailInput): Promise<MailResult> {
  const c = mailConfig();
  const t = getTransporter();
  let result: MailResult;
  if (!t) {
    result = { ok: false, status: "sin_configurar", error: "El envío de correo no está configurado (SMTP)." };
  } else {
    try {
      const info = await t.sendMail({ from: c.from, replyTo: c.replyTo, to: m.to, subject: m.subject, html: m.html, text: m.text });
      if (c.mode === "log") {
        const dir = path.join(path.dirname(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "x")), "outbox");
        fs.mkdirSync(dir, { recursive: true });
        const name = `${new Date().toISOString().replace(/[:.]/g, "-")}-${m.kind}-${m.to.replace(/[^a-z0-9@.]/gi, "_")}.eml`;
        fs.writeFileSync(path.join(dir, name), (info as unknown as { message: Buffer }).message);
        result = { ok: true, status: "simulado" };
      } else {
        result = { ok: true, status: "enviado" };
      }
    } catch (e) {
      result = { ok: false, status: "error", error: e instanceof Error ? e.message : String(e) };
    }
  }
  getDb()
    .prepare("INSERT INTO email_log (to_email, user_id, kind, subject, status, error, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(m.to, m.userId ?? null, m.kind, m.subject, result.status, result.error ?? null, m.sentBy ?? null);
  return result;
}

/** Comprueba la conexión y credenciales SMTP. */
export async function verifyMail(): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter();
  if (!t) return { ok: false, error: "Sin configurar" };
  if (mailConfig().mode === "log") return { ok: true };
  try {
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
