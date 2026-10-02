import { getCurrentUser } from "@/lib/auth";
import { can, scopeOf } from "@/lib/permissions";
import { formatDate, formatDuration } from "@/lib/learning";
import { SEGMENTS, listStudents, toCsv, type Segment, type Sort } from "@/lib/students";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "alumnos.ver")) return new Response("No autorizado", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const estado = sp.get("estado") ?? "";
  const { rows } = listStudents({
    scope: scopeOf(user),
    q: sp.get("q") ?? undefined, department: sp.get("dep") ?? undefined,
    segment: (estado in SEGMENTS ? estado : "") as Segment | "",
    courseId: Number(sp.get("curso")) || undefined, groupId: Number(sp.get("grupo")) || undefined, role: sp.get("rol") ?? undefined,
    sort: (sp.get("orden") ?? "nombre") as Sort, dir: sp.get("dir") === "desc" ? "desc" : "asc", page: 1, pageSize: 100000,
  });
  const csv = toCsv(
    ["Apellidos", "Nombre", "Email", "NIF", "Teléfono", "Empresa", "Departamento", "Puesto", "Rol", "Activo", "Cuenta activada",
      "Alta", "Último acceso", "Cursos", "Completados", "Obligatorios pendientes", "Vencidos", "Dedicación"],
    rows.map((r) => [r.last_name, r.first_name, r.email, r.nif, r.phone, r.company, r.department, r.job_title, r.role,
      r.active ? "Sí" : "No", r.pending ? "No" : "Sí", formatDate(r.created_at), formatDate(r.last_login_at, true),
      r.enrolled, r.completed, r.mandatory_pending, r.overdue, formatDuration(r.time_sec)])
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="alumnos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
