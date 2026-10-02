import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listCourses } from "@/lib/learning";
import { SEGMENTS, SORTS, departments, listGroups, listStudents, type Segment, type Sort } from "@/lib/students";
import { NewUserForm } from "./NewUserForm";
import { UsersTable } from "./UsersTable";

export const metadata = { title: "Alumnos" };

type SP = { q?: string; dep?: string; estado?: string; curso?: string; grupo?: string; rol?: string; orden?: string; dir?: string; p?: string; nuevo?: string };

export default async function Usuarios({ searchParams }: { searchParams: Promise<SP> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const sort = (sp.orden && sp.orden in SORTS ? sp.orden : "nombre") as Sort;
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(sp.p) || 1);
  const pageSize = 25;
  const filters = {
    q: sp.q?.trim(), department: sp.dep, segment: (sp.estado && sp.estado in SEGMENTS ? sp.estado : "") as Segment | "",
    courseId: Number(sp.curso) || undefined, groupId: Number(sp.grupo) || undefined, role: sp.rol || undefined,
  };
  const { rows, total } = listStudents({ ...filters, sort, dir, page, pageSize });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const courses = listCourses();
  const groups = listGroups();

  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && !["p", "nuevo"].includes(k))) as Record<string, string>;
  const href = (over: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams({ ...keep, ...Object.fromEntries(Object.entries(over).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
    return `/admin/usuarios?${q}`;
  };
  const exportQs = new URLSearchParams(keep).toString();
  const filtered = Object.keys(keep).some((k) => !["orden", "dir"].includes(k));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Alumnos</span> ({total})
          </h1>
          <p className="muted" style={{ margin: 0 }}>Altas, seguimiento e inscripciones del personal en formación.</p>
        </div>
        <div className="actions">
          <a className="btn ghost" href={`/api/admin/usuarios-export?${exportQs}`}>Exportar listado</a>
          <Link href="/admin/usuarios/importar" className="btn ghost">Importar CSV</Link>
          <Link href={href({ nuevo: 1 })} className="btn">Nuevo alumno</Link>
        </div>
      </div>

      {sp.nuevo && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">
            <h3>Alta de alumno</h3>
            <Link href={href({})} className="small">Cerrar</Link>
          </div>
          <NewUserForm canSetRole={staff.role === "admin"} groups={groups.map((g) => ({ id: g.id, name: g.name }))} />
        </div>
      )}

      <form className="toolbar">
        <input className="input" name="q" defaultValue={sp.q} placeholder="Nombre, email o NIF" style={{ minWidth: 220 }} />
        <select className="input" name="estado" defaultValue={sp.estado ?? ""}>
          <option value="">Cualquier estado</option>
          {Object.entries(SEGMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" name="dep" defaultValue={sp.dep ?? ""}>
          <option value="">Todos los departamentos</option>
          {departments().map((d) => <option key={d}>{d}</option>)}
        </select>
        <select className="input" name="curso" defaultValue={sp.curso ?? ""}>
          <option value="">Cualquier curso</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        {groups.length > 0 && (
          <select className="input" name="grupo" defaultValue={sp.grupo ?? ""}>
            <option value="">Cualquier grupo</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <select className="input" name="rol" defaultValue={sp.rol ?? ""}>
          <option value="">Todos los roles</option>
          <option value="alumno">Alumno/a</option>
          <option value="tutor">Tutor/a</option>
          <option value="admin">Administración</option>
        </select>
        {sp.orden && <input type="hidden" name="orden" value={sp.orden} />}
        {sp.dir && <input type="hidden" name="dir" value={sp.dir} />}
        <button className="btn ghost">Filtrar</button>
        {filtered && <Link href="/admin/usuarios" className="small">Limpiar filtros</Link>}
      </form>

      <UsersTable
        rows={rows}
        isAdmin={staff.role === "admin"}
        selfId={staff.id}
        courses={courses.map((c) => ({ id: c.id, title: c.title }))}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        sort={sort}
        dir={dir}
        sortHrefs={Object.fromEntries(
          (Object.keys(SORTS) as Sort[]).map((k) => [k, href({ orden: k, dir: sort === k && dir === "asc" ? "desc" : "asc" })])
        )}
        pager={
          <div className="pager">
            <span>
              {total === 0 ? "Sin resultados" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
            </span>
            <span className="actions">
              {page > 1 && <Link className="btn sm ghost" href={href({ p: page - 1 })}>Anterior</Link>}
              <span>Página {page} de {pages}</span>
              {page < pages && <Link className="btn sm ghost" href={href({ p: page + 1 })}>Siguiente</Link>}
            </span>
          </div>
        }
      />
    </>
  );
}
