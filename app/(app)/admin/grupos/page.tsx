import Link from "next/link";
import { formatDate } from "@/lib/learning";
import { listGroups } from "@/lib/students";
import { createGroup } from "./actions";

export const metadata = { title: "Grupos" };

export default async function Grupos() {
  const groups = listGroups();
  const today = new Date().toISOString().slice(0, 10);
  const state = (g: { start_date: string | null; end_date: string | null }) =>
    g.end_date && g.end_date < today ? ["Finalizado", "grey"] : g.start_date && g.start_date > today ? ["Próximo", ""] : ["En curso", "ok"];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Grupos</span> y convocatorias
          </h1>
          <p className="muted" style={{ margin: 0 }}>Agrupa alumnos, asígnales cursos y una fecha límite común y sigue su avance.</p>
        </div>
      </div>
      <form action={createGroup} className="card toolbar">
        <input className="input" name="name" placeholder="Nombre (p. ej. Renovaciones · octubre 2026)" required style={{ minWidth: 300, flex: 1 }} />
        <label className="actions small" style={{ gap: 6 }}>Inicio <input className="input" type="date" name="start_date" /></label>
        <label className="actions small" style={{ gap: 6 }}>Fin <input className="input" type="date" name="end_date" /></label>
        <button className="btn">Crear grupo</button>
      </form>
      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <table className="table">
          <thead><tr><th>Grupo</th><th>Estado</th><th>Fechas</th><th>Tutor/a</th><th className="num">Alumnos</th><th className="num">Cursos</th></tr></thead>
          <tbody>
            {groups.length === 0 && <tr><td colSpan={6} className="muted">Todavía no hay grupos.</td></tr>}
            {groups.map((g) => {
              const [label, cls] = state(g);
              return (
                <tr key={g.id}>
                  <td><Link href={`/admin/grupos/${g.id}`}>{g.name}</Link></td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                  <td className="nowrap">{formatDate(g.start_date)} – {formatDate(g.end_date)}</td>
                  <td>{g.tutor_name ?? "—"}</td>
                  <td className="num">{g.members}</td>
                  <td className="num">{g.courses}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
