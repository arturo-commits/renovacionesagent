import Link from "next/link";
import { getDb } from "@/lib/db";
import { ProgressBar } from "@/components/Progress";
import { formatDate, formatDuration } from "@/lib/learning";
import { courseStats } from "./stats";

export const metadata = { title: "Panel de gestión" };

export default async function AdminHome() {
  const db = getDb();
  const users = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE active = 1").get() as { n: number }).n;
  const stats = courseStats();
  const enrolled = stats.reduce((a, c) => a + c.enrolled, 0);
  const completed = stats.reduce((a, c) => a + c.completed, 0);
  const time = stats.reduce((a, c) => a + c.time_sec, 0);
  const recent = db
    .prepare("SELECT id, first_name, last_name, email, department, created_at FROM users ORDER BY id DESC LIMIT 6")
    .all() as { id: number; first_name: string; last_name: string; email: string; department: string | null; created_at: string }[];
  const active7 = (db.prepare("SELECT COUNT(DISTINCT user_id) AS n FROM activity_log WHERE created_at > datetime('now', '-7 days')").get() as { n: number }).n;

  return (
    <>
      <div className="page-head">
        <h1>
          <span className="accent">Panel</span> de gestión
        </h1>
        <div className="actions">
          <Link href="/admin/usuarios?nuevo=1" className="btn ghost">Nuevo usuario</Link>
          <Link href="/admin/informes" className="btn">Informes</Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="card stat"><div className="num">{users}</div><div className="lbl">Usuarios activos</div></div>
        <div className="card stat"><div className="num">{active7}</div><div className="lbl">Activos últimos 7 días</div></div>
        <div className="card stat">
          <div className="num">{enrolled ? Math.round((completed / enrolled) * 100) : 0}%</div>
          <div className="lbl">Tasa de finalización ({completed}/{enrolled})</div>
        </div>
        <div className="card stat"><div className="num">{formatDuration(time)}</div><div className="lbl">Tiempo total de formación</div></div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Cursos</h2>
          <Link href="/admin/cursos" className="small">Gestionar</Link>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Curso</th><th className="num">Inscritos</th><th className="num">En curso</th><th className="num">Completados</th>
                <th>Progreso medio</th><th className="num">Nota media</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/cursos/${c.id}`}>{c.title}</Link>{" "}
                    {!c.published && <span className="badge danger">Borrador</span>}
                    {c.mandatory ? <span className="badge warn">Obligatorio</span> : null}
                  </td>
                  <td className="num">{c.enrolled}</td>
                  <td className="num">{c.started}</td>
                  <td className="num">{c.completed}</td>
                  <td style={{ minWidth: 140 }}><ProgressBar percent={c.avg_progress} /></td>
                  <td className="num">{c.avg_score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Últimas altas</h2>
          <Link href="/admin/usuarios" className="small">Ver usuarios</Link>
        </div>
        <table className="table">
          <tbody>
            {recent.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/usuarios/${u.id}`}>{u.first_name} {u.last_name}</Link></td>
                <td className="muted">{u.email}</td>
                <td>{u.department ?? "—"}</td>
                <td className="nowrap">{formatDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
