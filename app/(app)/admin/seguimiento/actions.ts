"use server";

import { revalidatePath } from "next/cache";
import { requirePerm } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { remindEnrollments, sendAccessLink } from "@/lib/notify";
import { scopeOf } from "@/lib/permissions";
import { followUps } from "@/lib/students";

export type RemindState = { ok?: string; error?: string } | undefined;

const KIND = { vencidos: "vencido", proximos: "vence_pronto", sin_empezar: "sin_empezar", estancados: "sin_avanzar" } as const;

export async function remindSection(section: keyof ReturnType<typeof followUps>, _: RemindState): Promise<RemindState> {
  const staff = await requirePerm("seguimiento.gestionar");
  const rows = followUps(scopeOf(staff))[section];
  if (section === "sin_acceso") {
    const pending = rows.filter((r) => (getDb().prepare("SELECT password_hash FROM users WHERE id = ?").get(r.user_id) as { password_hash: string }).password_hash.startsWith("!"));
    let ok = 0;
    for (const r of pending) if ((await sendAccessLink(r.user_id, staff.id)).mail?.ok) ok++;
    revalidatePath("/admin/seguimiento");
    return pending.length ? { ok: `Invitación reenviada a ${ok} de ${pending.length} alumno(s) sin activar.` } : { error: "Nadie pendiente de activar la cuenta." };
  }
  const r = await remindEnrollments(rows.map((x) => x.enrollment_id!).filter(Boolean), KIND[section], staff.id);
  if (r.notConfigured) return { error: "El envío de correo no está configurado." };
  revalidatePath("/admin/seguimiento");
  return { ok: `Recordatorio enviado a ${r.sent} alumno(s)${r.failed ? ` · ${r.failed} con error (ver Correo)` : ""}.` };
}
