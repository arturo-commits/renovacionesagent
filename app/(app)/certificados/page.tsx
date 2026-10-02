import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { formatDate, userEnrollments } from "@/lib/learning";

export const metadata = { title: "Certificados" };

export default async function Certificados() {
  const user = await requireUser();
  const done = userEnrollments(user.id).filter((e) => e.status === "completado");
  return (
    <>
      <div className="page-head">
        <h1>
          <span className="accent">Mis</span> certificados
        </h1>
      </div>
      {done.length === 0 ? (
        <div className="card empty">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/mapachin-birrete.svg" alt="" />
          <p>Cuando completes un curso, su certificado aparecerá aquí.</p>
          <Link href="/mis-cursos" className="btn">Ir a mis cursos</Link>
        </div>
      ) : (
        <div className="grid grid-3">
          {done.map((e) => (
            <div className="card" key={e.enrollment_id}>
              <Icon name="award" size={32} className="accent" />
              <h3 style={{ marginTop: 12 }}>{e.title}</h3>
              <p className="small muted">
                Completado el {formatDate(e.completed_at)} · {e.hours} h{e.final_score != null ? ` · Nota ${e.final_score}` : ""}
              </p>
              <Link className="btn sm" href={`/certificado/${e.enrollment_id}`}>
                <Icon name="download" /> Ver / descargar
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
