import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/learning";
import {
  PERMISSIONS, ROLES, ROLE_DESCRIPTION, ROLE_LABEL, assignableRoles, can, permissionsOf, type Permission, type Role,
} from "@/lib/permissions";
import { departments } from "@/lib/students";
import { removeFromTeam } from "./actions";
import { AddMemberForm } from "./AddMemberForm";

export const metadata = { title: "Equipo y roles" };

export default async function Equipo() {
  const staff = await requirePerm("alumnos.ver");
  const team = getDb()
    .prepare(
      `SELECT id, first_name, last_name, email, department, role, scope_departments, active, last_login_at,
        CASE WHEN password_hash LIKE '!%' THEN 1 ELSE 0 END AS pending
       FROM users WHERE role <> 'alumno'
       ORDER BY CASE role WHEN 'superadmin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, last_name`
    )
    .all() as { id: number; first_name: string; last_name: string; email: string; department: string | null; role: Role; scope_departments: string | null; active: number; last_login_at: string | null; pending: number }[];
  const roles: Role[] = assignableRoles(staff).filter((r) => r !== "alumno");
  const manage = can(staff, "alumnos.editar") && roles.length > 0;
  const staffRoles = ROLES.filter((r) => r !== "alumno");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Equipo</span> y roles
          </h1>
          <p className="muted" style={{ margin: 0 }}>Quién controla la información de la plataforma y quién hace el seguimiento de los alumnos.</p>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {staffRoles.map((r) => (
          <div className="card" key={r}>
            <div className="eyebrow"><span className="pill-num">{team.filter((t) => t.role === r).length}</span> personas</div>
            <h3>{ROLE_LABEL[r]}</h3>
            <p className="small muted" style={{ margin: 0 }}>{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Equipo de gestión</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Ámbito</th><th>Último acceso</th><th /></tr></thead>
            <tbody>
              {team.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">
                    <Link href={`/admin/usuarios/${t.id}`}>{t.last_name}, {t.first_name}</Link>
                    {t.id === staff.id && <span className="small muted"> (tú)</span>}
                  </td>
                  <td className="muted">{t.email}</td>
                  <td>
                    <span className={`badge ${t.role === "superadmin" ? "solid" : t.role === "admin" ? "" : "grey"}`}>{ROLE_LABEL[t.role]}</span>
                    {!t.active && <span className="badge danger" style={{ marginLeft: 6 }}>Desactivado</span>}
                    {t.pending ? <span className="badge warn" style={{ marginLeft: 6 }}>Sin activar</span> : null}
                  </td>
                  <td className="small">{t.role === "tutor" ? (t.scope_departments?.split("|").join(", ") || "Todos los alumnos") : "Toda la plataforma"}</td>
                  <td className="nowrap small">{formatDate(t.last_login_at, true)}</td>
                  <td className="actions-cell">
                    {manage && t.id !== staff.id && roles.includes(t.role) && (
                      <form action={removeFromTeam.bind(null, t.id)}>
                        <ConfirmButton className="btn sm ghost" message={`¿Quitar a ${t.first_name} del equipo? Pasará a ser alumno/a.`}>Quitar</ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          El rol, el ámbito y la activación de cada persona se cambian desde su ficha. Siempre debe quedar al menos una cuenta de superadministración.
        </p>
      </div>

      {manage && (
        <div className="card">
          <h3>Añadir al equipo</h3>
          {staff.role !== "superadmin" && <p className="small muted">Como Administración de formación puedes añadir personas de Seguimiento. Para crear administradores pide ayuda a Superadministración.</p>}
          <AddMemberForm roles={roles} departments={departments()} />
        </div>
      )}

      <div className="card">
        <h3>Qué puede hacer cada rol</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Permiso</th>{staffRoles.map((r) => <th key={r} style={{ textAlign: "center" }}>{ROLE_LABEL[r]}</th>)}</tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                <tr key={p}>
                  <td className="small">{PERMISSIONS[p]}</td>
                  {staffRoles.map((r) => (
                    <td key={r} style={{ textAlign: "center" }}>
                      {permissionsOf(r).includes(p) ? <span className="accent"><Icon name="check" /></span> : <span className="muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>Seguimiento con ámbito limitado solo ve los alumnos, informes y avisos de sus departamentos.</p>
      </div>
    </>
  );
}
