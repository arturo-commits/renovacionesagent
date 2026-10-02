import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { can, scopeOf } from "@/lib/permissions";
import { Icon, UNIT_ICON } from "@/components/Icon";
import { UNIT_TYPE_LABEL, getCourse, getCourseTree } from "@/lib/learning";
import {
  addModule, addUnit, bulkEnroll, deleteCourse, deleteModule, deleteUnit, moveModule, moveUnit, renameModule,
} from "../../actions";
import { departments } from "../../stats";
import { CourseForm, UnitForm } from "./forms";
import { ConfirmButton } from "@/components/ConfirmButton";

export const metadata = { title: "Editar curso" };

export default async function EditCourse({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ unidad?: string }>;
}) {
  const staff = await requirePerm("cursos.ver");
  const courseId = Number((await params).id);
  const selected = Number((await searchParams).unidad) || null;
  const course = getCourse(courseId);
  if (!course) notFound();
  const tree = getCourseTree(courseId);
  const unit = tree.flatMap((m) => m.units).find((u) => u.id === selected);
  const isAdmin = can(staff, "cursos.editar");

  return (
    <>
      <div className="small muted" style={{ marginBottom: 12 }}>
        <Link href="/admin/cursos">Cursos</Link> / {course.title}
      </div>
      <div className="page-head">
        <h1>{course.title}</h1>
        <div className="actions">
          <Link href={`/cursos/${courseId}`} className="btn ghost">Ver como alumno</Link>
          {isAdmin && (
            <form action={deleteCourse.bind(null, courseId)}>
              <ConfirmButton className="btn danger" message="¿Eliminar el curso con todas sus unidades, inscripciones y progreso? No se puede deshacer.">Eliminar curso</ConfirmButton>
            </form>
          )}
        </div>
      </div>

      <div className="split">
        <div>
          <div className="card">
            <h3>Estructura</h3>
            {tree.map((m, i) => (
              <div key={m.id} className="module" style={{ marginBottom: 12 }}>
                <div style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                  <span className="pill-num">{i + 1}</span>
                  {isAdmin ? (
                    <form action={renameModule.bind(null, courseId, m.id)} className="actions" style={{ flex: 1 }}>
                      <input className="input" name="title" defaultValue={m.title} style={{ flex: 1 }} />
                      <button className="btn sm ghost">Renombrar</button>
                    </form>
                  ) : (
                    <b style={{ flex: 1 }}>{m.title}</b>
                  )}
                  {isAdmin && (
                    <div className="actions">
                      <form action={moveModule.bind(null, courseId, m.id, -1)}><button className="btn sm ghost" aria-label="Subir"><Icon name="up" size={14} /></button></form>
                      <form action={moveModule.bind(null, courseId, m.id, 1)}><button className="btn sm ghost" aria-label="Bajar"><Icon name="down" size={14} /></button></form>
                      <form action={deleteModule.bind(null, courseId, m.id)}><ConfirmButton label="Eliminar módulo" message="¿Eliminar el módulo y todas sus unidades?"><Icon name="trash" size={14} /></ConfirmButton></form>
                    </div>
                  )}
                </div>
                <ul className="unit-list">
                  {m.units.map((u) => (
                    <li key={u.id} style={{ display: "flex", alignItems: "center" }}>
                      <Link href={`/admin/cursos/${courseId}?unidad=${u.id}#unidad`} style={{ flex: 1, background: u.id === selected ? "var(--accent-soft)" : undefined }}>
                        <Icon name={UNIT_ICON[u.type]} />
                        {u.title}
                        <span className="meta"><span className="badge grey">{UNIT_TYPE_LABEL[u.type]}</span>{u.duration_min} min</span>
                      </Link>
                      {isAdmin && (
                        <div className="actions" style={{ paddingRight: 12 }}>
                          <form action={moveUnit.bind(null, courseId, m.id, u.id, -1)}><button className="btn sm ghost" aria-label="Subir"><Icon name="up" size={14} /></button></form>
                          <form action={moveUnit.bind(null, courseId, m.id, u.id, 1)}><button className="btn sm ghost" aria-label="Bajar"><Icon name="down" size={14} /></button></form>
                        </div>
                      )}
                    </li>
                  ))}
                  {isAdmin && (
                    <li style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
                      <form action={addUnit.bind(null, courseId, m.id)} className="actions">
                        <input className="input" name="title" placeholder="Nueva unidad" required style={{ flex: 1, minWidth: 160 }} />
                        <select className="input" name="type" style={{ width: 130 }}>
                          {Object.entries(UNIT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button className="btn sm"><Icon name="plus" size={14} /> Añadir</button>
                      </form>
                    </li>
                  )}
                </ul>
              </div>
            ))}
            {isAdmin && (
              <form action={addModule.bind(null, courseId)} className="actions" style={{ marginTop: 12 }}>
                <input className="input" name="title" placeholder={`Módulo ${tree.length + 1}. …`} style={{ flex: 1 }} />
                <button className="btn ghost"><Icon name="plus" size={14} /> Añadir módulo</button>
              </form>
            )}
          </div>

          {unit && (
            <div className="card" id="unidad">
              <div className="card-title">
                <h3>Editar unidad</h3>
                {isAdmin && (
                  <form action={deleteUnit.bind(null, courseId, unit.id)}>
                    <ConfirmButton message="¿Eliminar esta unidad y el progreso asociado?">Eliminar unidad</ConfirmButton>
                  </form>
                )}
              </div>
              {isAdmin ? <UnitForm courseId={courseId} unit={unit} key={unit.id} /> : <p className="muted">Solo administración puede editar contenidos.</p>}
            </div>
          )}
        </div>

        <aside>
          <div className="card">
            <h3>Datos del curso</h3>
            {isAdmin ? <CourseForm course={course} /> : <p className="muted small">{course.description}</p>}
          </div>
          {can(staff, "inscripciones.gestionar") && <div className="card">
            <h3>Inscripción masiva</h3>
            <p className="small muted">Inscribe en este curso a todos los usuarios activos, o solo a los de un departamento.</p>
            <form action={bulkEnroll.bind(null, courseId)} className="form">
              <select className="input" name="department">
                <option value="">Todos los usuarios</option>
                {departments(scopeOf(staff)).map((d) => <option key={d}>{d}</option>)}
              </select>
              <button className="btn ghost">Inscribir</button>
            </form>
          </div>}
        </aside>
      </div>
    </>
  );
}
