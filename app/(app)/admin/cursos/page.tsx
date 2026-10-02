import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PRODUCT_LABEL, listCourses, unitCount } from "@/lib/learning";
import { createCourse } from "../actions";
import { courseStats } from "../stats";

export const metadata = { title: "Gestión de cursos" };

export default async function AdminCursos() {
  const staff = await requirePerm("cursos.ver");
  const stats = new Map(courseStats().map((s) => [s.id, s]));
  const courses = listCourses();
  return (
    <>
      <div className="page-head">
        <h1>
          <span className="accent">Gestión</span> de cursos
        </h1>
        {can(staff, "cursos.editar") && (
          <form action={createCourse} className="actions">
            <input className="input" name="title" placeholder="Título del nuevo curso" required style={{ width: 260 }} />
            <select className="input" name="product" style={{ width: 140 }}>
              {Object.entries(PRODUCT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn">Crear curso</button>
          </form>
        )}
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr><th>Curso</th><th>Ramo</th><th>Estado</th><th className="num">Horas</th><th className="num">Unidades</th><th className="num">Inscritos</th><th className="num">Completados</th></tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/cursos/${c.id}`}>{c.title}</Link> {c.mandatory ? <span className="badge warn">Obligatorio</span> : null}</td>
                <td>{PRODUCT_LABEL[c.product] ?? c.product}</td>
                <td>{c.published ? <span className="badge ok">Publicado</span> : <span className="badge danger">Borrador</span>}</td>
                <td className="num">{c.hours}</td>
                <td className="num">{unitCount(c.id)}</td>
                <td className="num">{stats.get(c.id)?.enrolled ?? 0}</td>
                <td className="num">{stats.get(c.id)?.completed ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
