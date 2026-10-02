import { Logo, Dots } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth">
      <section className="auth-side">
        <Logo href="/login" />
        <div>
          <Dots />
          <h1 style={{ marginTop: 16 }}>
            <span className="accent">Aprende</span> todo sobre los seguros de Tuio
          </h1>
          <p>Cursos de producto, coberturas, contratación, renovaciones y siniestros. Tu progreso y tu expediente de formación, siempre a mano.</p>
        </div>
        <div className="art-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/mapachin-birrete.svg" alt="Mapachín, la mascota de Tuio" />
        </div>
        <p className="small" style={{ color: "#9dbccb", margin: 0 }}>© {new Date().getFullYear()} Tuio · Formación interna</p>
      </section>
      <section className="auth-form">
        <div className="box">{children}</div>
      </section>
    </div>
  );
}
