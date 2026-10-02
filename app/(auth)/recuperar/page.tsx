import Link from "next/link";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Recuperar contraseña" };

export default function Recuperar() {
  return (
    <>
      <h2>
        <span className="accent">Recupera</span> tu contraseña
      </h2>
      <p className="muted">Te enviaremos un enlace desde formacion@tuio.com para crear una nueva.</p>
      <ForgotForm />
      <p className="small muted" style={{ marginTop: 24 }}>
        <Link href="/login">Volver al acceso</Link>
      </p>
    </>
  );
}
