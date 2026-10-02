import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { toCsv } from "@/lib/students";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user, "alumnos.editar")) return new Response("No autorizado", { status: 403 });
  const csv = toCsv(
    ["nombre", "apellidos", "email", "nif", "telefono", "empresa", "departamento", "puesto", "rol", "cursos", "grupo", "fecha_limite"],
    [["Ana", "Martín López", "ana.martin@tuio.com", "12345678Z", "600000000", "Tuio", "Siniestros", "Tramitadora", "alumno", "seguro-hogar|seguro-auto", "", "31/12/2026"]]
  );
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="plantilla-alumnos.csv"' },
  });
}
