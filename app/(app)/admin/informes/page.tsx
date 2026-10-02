import Link from "next/link";
import { ProgressBar } from "@/components/Progress";
import { STATUS_LABEL, formatDate, formatDuration, listCourses, type Enrollment } from "@/lib/learning";
import { departments, enrollmentReport } from "../stats";
import { listGroups } from "@/lib/students";
import { requirePerm } from "@/lib/auth";
import { scopeOf } from "@/lib/permissions";

export const metadata = { title: "Informes" };

export default async function Informes({ searchParams }: { searchParams: Promise<{ curso?: string; estado?: string; dep?: string; grupo?: string }> }) {
  const staff = await requirePerm("informes.ver");
  const sp = await searchParams;
  const filters = { courseId: Number(sp.curso) || undefined, status: sp.estado || undefined, department: sp.dep || undefined, groupId: Number(sp.grupo) || undefined, scope: scopeOf(staff) };
  const rows = enrollmentReport(filters);
  const today = new Date().toISOString().slice(0, 10);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Informe</span> de formación
          </h1>
          <p className="muted" style={{ margin: 0 }}>Registro de formación por alumno y curso: inscripción, accesos, dedicación y resultados.</p>
        </div>
        <a className="btn" href={`/api/admin/export?${qs}`}>Exportar CSV</a>
      </div>
      <form className="actions" style={{ marginBottom: 16 }}>
        <select className="input" name="curso" defaultValue={sp.curso ?? ""} style={{ maxWidth: 260 }}>
          <option value="">Todos los cursos</option>
          {listCourses().map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select className="input" name="estado" defaultValue={sp.estado ?? ""} style={{ maxWidth: 180 }}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" name="dep" defaultValue={sp.dep ?? ""} style={{ maxWidth: 220 }}>
          <option value="">Todos los departamentos</option>
          {departments(scopeOf(staff)).map((d) => <option key={d}>{d}</option>)}
        </select>
        {listGroups().length > 0 && (
          <select className="input" name="grupo" defaultValue={sp.grupo ?? ""} style={{ maxWidth: 220 }}>
            <option value="">Todos los grupos</option>
            {listGroups().map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <button className="btn ghost">Filtrar</button>
      </form>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Alumno</th><th>Departamento</th><th>Curso</th><th>Estado</th><th>Progreso</th><th>Inscripción</th><th>Último acceso</th><th>Fecha límite</th><th>Finalización</th><th className="num">Dedicación</th><th className="num">Nota</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={11} className="muted">Sin resultados.</td></tr>}
              {rows.map((r) => (
                <tr key={r.enrollment_id}>
                  <td><Link href={`/admin/usuarios/${r.user_id}`}>{r.last_name}, {r.first_name}</Link></td>
                  <td>{r.department ?? "—"}</td>
                  <td>{r.course}</td>
                  <td><span className={`badge ${r.status === "completado" ? "ok" : r.status === "inscrito" ? "grey" : ""}`}>{STATUS_LABEL[r.status as Enrollment["status"]]}</span></td>
                  <td style={{ minWidth: 110 }}><ProgressBar percent={r.progress} /></td>
                  <td className="nowrap">{formatDate(r.enrolled_at)}</td>
                  <td className="nowrap">{formatDate(r.last_access_at, true)}</td>
                  <td className="nowrap">{r.due_at ? <span className={r.status !== "completado" && r.due_at < today ? "badge danger" : ""}>{formatDate(r.due_at)}</span> : "—"}</td>
                  <td className="nowrap">{formatDate(r.completed_at)}</td>
                  <td className="num nowrap">{formatDuration(r.time_spent_sec)}</td>
                  <td className="num">{r.final_score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
