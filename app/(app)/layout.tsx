import { Shell } from "@/components/Shell";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, can, isStaff, scopeOf, type Permission } from "@/lib/permissions";
import { logout } from "../(auth)/actions";


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const initials = (user.first_name[0] + (user.last_name[0] ?? "")).toUpperCase();

  const sections = [
    {
      items: [
        { href: "/inicio", label: "Inicio", icon: "home" },
        { href: "/mis-cursos", label: "Mis cursos", icon: "book" },
        { href: "/catalogo", label: "Catálogo", icon: "grid" },
        { href: "/expediente", label: "Mi expediente", icon: "file" },
        { href: "/certificados", label: "Certificados", icon: "award" },
        { href: "/perfil", label: "Mi perfil", icon: "user" },
      ],
    },
  ];
  if (isStaff(user)) {
    const admin: [string, string, string, Permission][] = [
      ["/admin", "Panel", "chart", "panel.ver"],
      ["/admin/usuarios", "Alumnos", "users", "alumnos.ver"],
      ["/admin/grupos", "Grupos", "grid", "grupos.ver"],
      ["/admin/seguimiento", "Seguimiento", "clock", "alumnos.ver"],
      ["/admin/cursos", "Cursos", "settings", "cursos.ver"],
      ["/admin/informes", "Informes", "download", "informes.ver"],
      ["/admin/correo", "Correo", "file", "correo.gestionar"],
      ["/admin/equipo", "Equipo y roles", "award", "alumnos.ver"],
    ];
    sections.push({
      label: "Gestión",
      items: admin.filter(([, , , p]) => can(user, p)).map(([href, label, icon]) => ({ href, label, icon })),
    } as (typeof sections)[number]);
  }
  const scope = scopeOf(user);

  return (
    <Shell
      logo={<Logo />}
      sections={sections}
      topRight={
        <div className="user-chip">
          <div className="who">
            <b>
              {user.first_name} {user.last_name}
            </b>
            <span className="muted">{ROLE_LABEL[user.role]}{scope ? ` · ${scope.join(", ")}` : ""}</span>
          </div>
          <div className="avatar">{initials}</div>
          <form action={logout}>
            <button className="btn ghost sm" title="Cerrar sesión" aria-label="Cerrar sesión">
              <Icon name="logout" />
            </button>
          </form>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
