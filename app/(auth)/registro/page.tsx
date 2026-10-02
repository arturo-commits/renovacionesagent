import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Registro" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/inicio");
  return (
    <>
      <h2>
        <span className="accent">Crea</span> tu cuenta
      </h2>
      <p className="muted">Tus datos se usan para tu expediente y tus certificados de formación.</p>
      <RegisterForm />
      <p className="small muted" style={{ marginTop: 24 }}>
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </>
  );
}
