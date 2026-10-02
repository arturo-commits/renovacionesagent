import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CourseCard } from "@/components/CourseCard";
import { unitCount, userEnrollments } from "@/lib/learning";

export const metadata = { title: "Mis cursos" };

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "en_curso", label: "En curso" },
  { key: "inscrito", label: "No iniciados" },
  { key: "completado", label: "Completados" },
] as const;

export default async function MisCursos({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const user = await requireUser();
  const { estado = "todos" } = await searchParams;
  const all = userEnrollments(user.id);
  const list = estado === "todos" ? all : all.filter((e) => e.status === estado);

  return (
    <>
      <div className="page-head">
        <h1>
          <span className="accent">Mis</span> cursos
        </h1>
      </div>
      <nav className="tabs">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/mis-cursos?estado=${f.key}`} className={estado === f.key ? "active" : ""}>
            {f.label} ({f.key === "todos" ? all.length : all.filter((e) => e.status === f.key).length})
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <div className="card empty">
          <p>No hay cursos en este estado.</p>
          <Link href="/catalogo" className="btn">
            Ir al catálogo
          </Link>
        </div>
      ) : (
        <div className="grid grid-3">
          {list.map((e) => (
            <CourseCard key={e.enrollment_id} course={{ ...e, id: e.course_id }} enrollment={e} progress={e.progress} units={unitCount(e.course_id)} />
          ))}
        </div>
      )}
    </>
  );
}
