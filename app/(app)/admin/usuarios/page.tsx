import Link from "next/link";
import { getDb } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/learning";
import { departments } from "../stats";
import { NewUserForm } from "./NewUserForm";

export const metadata = { title: "Usuarios" };

type Row = {
  id: number; first_name: string; last_name: string; email: string; department: string | null; role: string; active: number;
  last_login_at: string | null; enrolled: number; completed: number;
};

export default async function Usuarios({ searchParams }: { searchParams: Promise<{ q?: string; dep?: string; nuevo?: string }> }) {
  const staff = await requireStaff();
  const { q = "", dep = "", nuevo } = await searchParams;
  const where: string[] = [];
  const args: string[] = [];
  if (q) {
    where.push("(u.first_name || ' ' || u.last_name || ' ' || u.email || ' ' || COALESCE(u.nif, '')) LIKE ?");
    args.push(`%${q}%`);
  }
  if (dep) { where.push("u.department = ?"); args.push(dep); }
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.department, u.role, u.active, u.last_login_at,
        COUNT(e.id) AS enrolled, SUM(CASE WHEN e.status = 'completado' THEN 1 ELSE 0 END) AS completed
       FROM users u LEFT JOIN enrollments e ON e.user_id = u.id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       GROUP BY u.id ORDER BY u.last_name, u.first_name`
    )
    .all(...args) as Row[];

  return (
    <>
      <div className="page-head">
        <h1>
          <span className="accent">Usuarios</span> ({rows.length})
        </h1>
        <Link href="/admin/usuarios?nuevo=1" className="btn">Nuevo usuario</Link>
      </div>

      {nuevo && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Alta de usuario</h3>
          <NewUserForm canSetRole={staff.role === "admin"} />
        </div>
      )}

      <form className="actions" style={{ marginBottom: 16 }}>
        <input className="input" name="q" defaultValue={q} placeholder="Buscar por nombre, email o NIF" style={{ maxWidth: 320 }} />
        <select className="input" name="dep" defaultValue={dep} style={{ maxWidth: 220 }}>
          <option value="">Todos los departamentos</option>
          {departments().map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className="btn ghost">Filtrar</button>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Departamento</th><th>Rol</th><th className="num">Cursos</th><th className="num">Completados</th><th>Último acceso</th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/usuarios/${u.id}`}>{u.last_name}, {u.first_name}</Link>{" "}
                    {!u.active && <span className="badge danger">Inactivo</span>}
                  </td>
                  <td className="muted">{u.email}</td>
                  <td>{u.department ?? "—"}</td>
                  <td><span className="badge grey">{u.role}</span></td>
                  <td className="num">{u.enrolled}</td>
                  <td className="num">{u.completed ?? 0}</td>
                  <td className="nowrap">{formatDate(u.last_login_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
