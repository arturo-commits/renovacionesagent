import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Acceso" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/inicio");
  return (
    <>
      <h2>
        <span className="accent">Hola</span> de nuevo
      </h2>
      <p className="muted">Accede con tu email y contraseña.</p>
      <LoginForm />
      <p className="small muted" style={{ marginTop: 24 }}>
        ¿Aún no tienes cuenta? <Link href="/registro">Regístrate</Link>
      </p>
    </>
  );
}
