// Roles y permisos. Sin dependencias de servidor: se usa también en componentes de cliente.

export const ROLES = ["superadmin", "admin", "tutor", "alumno"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Superadministración",
  admin: "Administración de formación",
  tutor: "Seguimiento",
  alumno: "Alumno/a",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  superadmin: "Control total: gestiona el equipo de administración, los roles, el correo y puede eliminar datos.",
  admin: "Controla la información: alumnos, cursos y contenidos, grupos, informes, correo y seguimiento.",
  tutor: "Hace el seguimiento: consulta alumnos e informes, envía recordatorios, gestiona plazos, notas e inscripciones. Puede limitarse a unos departamentos.",
  alumno: "Realiza la formación.",
};

export const PERMISSIONS = {
  "panel.ver": "Ver el panel de gestión",
  "alumnos.ver": "Ver alumnos, fichas y expedientes",
  "alumnos.editar": "Dar de alta, importar y editar datos de alumnos",
  "alumnos.desactivar": "Activar y desactivar alumnos",
  "alumnos.eliminar": "Eliminar alumnos definitivamente",
  "inscripciones.gestionar": "Inscribir en cursos",
  "inscripciones.baja": "Dar de baja de cursos",
  "seguimiento.gestionar": "Notas, fechas límite, invitaciones y recordatorios",
  "cursos.ver": "Ver la gestión de cursos",
  "cursos.editar": "Crear y editar cursos y contenidos",
  "grupos.ver": "Ver grupos",
  "grupos.gestionar": "Crear y gestionar grupos",
  "informes.ver": "Ver y exportar informes",
  "correo.gestionar": "Ver el registro de correos y enviar pruebas",
  "equipo.gestionar": "Nombrar administradores y superadministradores",
} as const;
export type Permission = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as Permission[];

const MATRIX: Record<Role, Permission[]> = {
  superadmin: ALL,
  admin: ALL.filter((p) => p !== "equipo.gestionar" && p !== "alumnos.eliminar"),
  tutor: [
    "panel.ver", "alumnos.ver", "inscripciones.gestionar", "seguimiento.gestionar", "cursos.ver", "grupos.ver", "informes.ver",
  ],
  alumno: [],
};

export function can(user: { role: string } | null | undefined, perm: Permission): boolean {
  return !!user && (MATRIX[user.role as Role] ?? []).includes(perm);
}

export const isStaff = (user: { role: string } | null | undefined) => !!user && user.role !== "alumno";

/** Roles que un usuario puede asignar a otros. */
export function assignableRoles(user: { role: string }): Role[] {
  if (user.role === "superadmin") return [...ROLES];
  if (user.role === "admin") return ["tutor", "alumno"];
  return [];
}

export function permissionsOf(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}

/** Departamentos a los que está limitado un usuario de seguimiento (null = sin límite). */
export function scopeOf(user: { role: string; scope_departments?: string | null }): string[] | null {
  if (user.role !== "tutor" || !user.scope_departments) return null;
  const list = user.scope_departments.split("|").map((d) => d.trim()).filter(Boolean);
  return list.length ? list : null;
}
