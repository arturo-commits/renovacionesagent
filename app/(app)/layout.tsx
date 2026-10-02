import { Shell } from "@/components/Shell";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/auth";
import { logout } from "../(auth)/actions";

const ROLE_LABEL = { alumno: "Alumno/a", tutor: "Tutor/a", admin: "Administración" } as const;

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
  if (user.role !== "alumno") {
    sections.push({
      label: "Gestión",
      items: [
        { href: "/admin", label: "Panel", icon: "chart" },
        { href: "/admin/usuarios", label: "Usuarios", icon: "users" },
        { href: "/admin/cursos", label: "Cursos", icon: "settings" },
        { href: "/admin/informes", label: "Informes", icon: "download" },
      ],
    } as (typeof sections)[number]);
  }

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
            <span className="muted">{ROLE_LABEL[user.role]}</span>
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
