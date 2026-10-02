import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate, getCourse, getEnrollmentById } from "@/lib/learning";
import { PrintButton } from "./PrintButton";
import { can } from "@/lib/permissions";
import { canSeeStudent } from "@/lib/students";

export const metadata = { title: "Certificado" };

export default async function Certificado({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const enrollment = getEnrollmentById(Number((await params).id));
  if (!enrollment || enrollment.status !== "completado") notFound();
  if (enrollment.user_id !== viewer.id && !(can(viewer, "alumnos.ver") && canSeeStudent(viewer, enrollment.user_id))) notFound();
  const course = getCourse(enrollment.course_id)!;
  const student = getDb().prepare("SELECT first_name, last_name, nif FROM users WHERE id = ?").get(enrollment.user_id) as {
    first_name: string; last_name: string; nif: string | null;
  };
  const code = `TUIO-${String(enrollment.id).padStart(6, "0")}-${enrollment.course_id}`;

  return (
    <div className="cert-page">
      <div className="cert-toolbar">
        <Link href="/certificados" className="btn ghost sm">← Volver</Link>
        <PrintButton />
      </div>
      <div className="cert">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mascot" src="/illustrations/mapachin-birrete.svg" alt="" />
        <div className="logo-word">
          tu<span className="io" style={{ color: "var(--accent)" }}>io</span>
          <span className="logo-sub" style={{ marginLeft: 10, fontSize: 14 }}>Academy</span>
        </div>
        <h1>
          <span className="accent">Certificado</span> de aprovechamiento
        </h1>
        <p className="muted">Tuio certifica que</p>
        <div className="name">
          {student.first_name} {student.last_name}
        </div>
        {student.nif && <p className="muted" style={{ margin: 0 }}>NIF/NIE {student.nif}</p>}
        <p className="muted" style={{ marginTop: 24, marginBottom: 0 }}>ha completado satisfactoriamente el curso</p>
        <div className="course">{course.title}</div>
        <div className="meta">
          <div><span>Duración</span><b>{course.hours} horas</b></div>
          <div><span>Modalidad</span><b>{course.modality}</b></div>
          <div><span>Fecha de finalización</span><b>{formatDate(enrollment.completed_at)}</b></div>
          {enrollment.final_score != null && <div><span>Calificación</span><b>{enrollment.final_score}/100</b></div>}
          <div><span>Código</span><b>{code}</b></div>
        </div>
      </div>
    </div>
  );
}
