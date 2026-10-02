import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/learning";
import { enrollmentReport } from "@/app/(app)/admin/stats";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "alumno") return new Response("No autorizado", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const rows = enrollmentReport({
    courseId: Number(sp.get("curso")) || undefined,
    status: sp.get("estado") || undefined,
    department: sp.get("dep") || undefined,
    groupId: Number(sp.get("grupo")) || undefined,
  });
  const header = [
    "Apellidos", "Nombre", "Email", "NIF", "Empresa", "Departamento", "Curso", "Horas curso", "Estado", "Progreso %",
    "Fecha inscripción", "Primer acceso", "Último acceso", "Fecha límite", "Fecha finalización", "Dedicación (min)", "Nota",
  ];
  const lines = rows.map((r) =>
    [
      r.last_name, r.first_name, r.email, r.nif, r.company, r.department, r.course, r.hours, r.status, r.progress,
      formatDate(r.enrolled_at), formatDate(r.started_at, true), formatDate(r.last_access_at, true), formatDate(r.due_at), formatDate(r.completed_at),
      Math.round(r.time_spent_sec / 60), r.final_score,
    ].map(esc).join(";")
  );
  // Separador ";" y BOM para que Excel en español lo abra correctamente.
  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="informe-formacion-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
