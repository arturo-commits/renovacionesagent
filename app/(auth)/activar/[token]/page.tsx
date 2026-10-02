import Link from "next/link";
import { findInvitation } from "@/lib/students";
import { ActivateForm } from "./ActivateForm";

export const metadata = { title: "Activar cuenta" };

export default async function Activar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = findInvitation(token);
  const valid = inv && !inv.used_at && inv.expires_at > new Date().toISOString() && inv.active;
  if (!valid) {
    return (
      <>
        <h2>
          <span className="accent">Enlace</span> no válido
        </h2>
        <p className="muted">
          {inv?.used_at ? "Este enlace ya se ha usado. Si ya activaste tu cuenta, inicia sesión." : "El enlace ha caducado o no existe. Pide uno nuevo al equipo de formación."}
        </p>
        <Link href="/login" className="btn">Ir al acceso</Link>
      </>
    );
  }
  return (
    <>
      <h2>
        <span className="accent">Bienvenido/a,</span> {inv.first_name}
      </h2>
      <p className="muted">Crea tu contraseña para acceder a Tuio Academy con <b>{inv.email}</b>.</p>
      <ActivateForm token={token} />
    </>
  );
}
