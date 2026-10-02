import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CourseCard } from "@/components/CourseCard";
import { PRODUCT_LABEL, listCourses, progressFor, unitCount, getEnrollment } from "@/lib/learning";

export const metadata = { title: "Catálogo" };

export default async function Catalogo({ searchParams }: { searchParams: Promise<{ ramo?: string }> }) {
  const user = await requireUser();
  const { ramo = "todos" } = await searchParams;
  const courses = listCourses({ publishedOnly: true });
  const products = Array.from(new Set(courses.map((c) => c.product)));
  const list = ramo === "todos" ? courses : courses.filter((c) => c.product === ramo);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Catálogo</span> de formación
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Todos los cursos disponibles sobre los seguros de Tuio.
          </p>
        </div>
      </div>
      <nav className="tabs">
        <Link href="/catalogo" className={ramo === "todos" ? "active" : ""}>
          Todos
        </Link>
        {products.map((p) => (
          <Link key={p} href={`/catalogo?ramo=${p}`} className={ramo === p ? "active" : ""}>
            {PRODUCT_LABEL[p] ?? p}
          </Link>
        ))}
      </nav>
      <div className="grid grid-3">
        {list.map((c) => {
          const e = getEnrollment(user.id, c.id);
          return <CourseCard key={c.id} course={c} enrollment={e} progress={e ? progressFor(e.id, c.id) : undefined} units={unitCount(c.id)} />;
        })}
      </div>
    </>
  );
}
