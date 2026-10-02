import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { runAutomaticReminders } from "@/lib/notify";

/**
 * Recordatorios automáticos. Llamar una vez al día desde el cron del servidor:
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/recordatorios
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 503 });
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ ok: false }, { status: 401 });
  const result = await runAutomaticReminders(null);
  return NextResponse.json({ ok: true, ...result });
}

export const POST = handle;
export const GET = handle;
