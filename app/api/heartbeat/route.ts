import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addTime, getEnrollment, getUnitWithCourse } from "@/lib/learning";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { unitId?: number; seconds?: number };
  const unit = body.unitId ? getUnitWithCourse(Number(body.unitId)) : undefined;
  if (!unit) return NextResponse.json({ ok: false }, { status: 400 });
  const enrollment = getEnrollment(user.id, unit.course_id);
  if (!enrollment) return NextResponse.json({ ok: false }, { status: 403 });
  // Límite por pulso para que el cliente no pueda inflar el tiempo.
  const seconds = Math.min(Math.max(Number(body.seconds) || 0, 0), 60);
  addTime(enrollment.id, unit.id, seconds);
  return NextResponse.json({ ok: true });
}
