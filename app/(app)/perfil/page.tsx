import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/learning";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata = { title: "Mi perfil" };

export default async function Perfil() {
  const user = await requireUser();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Mi</span> perfil
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {user.email} · Alta el {formatDate(user.created_at)}
          </p>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h3>Datos personales</h3>
          <ProfileForm user={user} />
        </div>
        <div className="card">
          <h3>Cambiar contraseña</h3>
          <PasswordForm />
        </div>
      </div>
    </>
  );
}
