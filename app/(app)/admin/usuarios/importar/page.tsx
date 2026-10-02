import Link from "next/link";
import { listCourses } from "@/lib/learning";
import { listGroups } from "@/lib/students";
import { ImportForm } from "./ImportForm";

export const metadata = { title: "Importar alumnos" };

export default async function Importar() {
  const courses = listCourses();
  const groups = listGroups();
  return (
    <>
      <div className="small muted" style={{ marginBottom: 12 }}>
        <Link href="/admin/usuarios">Alumnos</Link> / Importar
      </div>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Importar</span> alumnos
          </h1>
          <p className="muted" style={{ margin: 0 }}>Alta masiva desde un CSV (desde Excel: Guardar como → CSV UTF-8).</p>
        </div>
        <a className="btn ghost" href="/api/admin/plantilla-alumnos">Descargar plantilla</a>
      </div>
      <div className="split">
        <div className="card">
          <ImportForm />
        </div>
        <aside className="card small">
          <h3>Columnas</h3>
          <table className="table">
            <tbody>
              <tr><td><b>nombre</b> *</td><td>Nombre</td></tr>
              <tr><td><b>apellidos</b> *</td><td>Apellidos</td></tr>
              <tr><td><b>email</b> *</td><td>Identifica al alumno</td></tr>
              <tr><td>nif</td><td>NIF o NIE</td></tr>
              <tr><td>telefono</td><td /></tr>
              <tr><td>empresa</td><td>Por defecto «Tuio»</td></tr>
              <tr><td>departamento</td><td /></tr>
              <tr><td>puesto</td><td /></tr>
              <tr><td>rol</td><td>alumno, tutor o admin</td></tr>
              <tr><td>cursos</td><td>Separados por «|». Id, título o código</td></tr>
              <tr><td>grupo</td><td>Nombre de un grupo existente</td></tr>
              <tr><td>fecha_limite</td><td>dd/mm/aaaa, para los cursos indicados</td></tr>
            </tbody>
          </table>
          <h3 style={{ marginTop: 16 }}>Cursos disponibles</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {courses.map((c) => <li key={c.id}><code>{c.slug}</code> — {c.title}</li>)}
          </ul>
          {groups.length > 0 && (
            <>
              <h3 style={{ marginTop: 16 }}>Grupos</h3>
              <ul style={{ paddingLeft: 18, margin: 0 }}>{groups.map((g) => <li key={g.id}>{g.name}</li>)}</ul>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
