"use server";

import { revalidatePath } from "next/cache";
import { requirePerm } from "@/lib/auth";
import { sendMail, verifyMail } from "@/lib/mail";
import { testMail } from "@/lib/mail-templates";
import { runAutomaticReminders } from "@/lib/notify";

export type MailState = { ok?: string; error?: string } | undefined;

export async function sendTest(_: MailState, form: FormData): Promise<MailState> {
  const staff = await requirePerm("correo.gestionar");
  const to = String(form.get("to") ?? "").trim() || staff.email;
  const check = await verifyMail();
  if (!check.ok) return { error: `No se puede conectar con el servidor de correo: ${check.error}` };
  const r = await sendMail({ ...testMail(staff.first_name), to, kind: "prueba", sentBy: staff.id });
  revalidatePath("/admin/correo");
  return r.ok ? { ok: r.status === "simulado" ? `Prueba guardada en data/outbox (modo simulado).` : `Correo de prueba enviado a ${to}.` } : { error: r.error };
}

export async function runRemindersNow(_: MailState): Promise<MailState> {
  const staff = await requirePerm("correo.gestionar");
  const r = await runAutomaticReminders(staff.id);
  revalidatePath("/admin/correo");
  if (r.notConfigured) return { error: "El envío de correo no está configurado." };
  return { ok: r.users ? `Recordatorios: ${r.sent} enviados${r.failed ? `, ${r.failed} con error` : ""}.` : "No hay recordatorios pendientes hoy." };
}
