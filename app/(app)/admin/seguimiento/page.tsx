import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { formatDate } from "@/lib/learning";
import { followUps, type FollowUpRow } from "@/lib/students";

export const metadata = { title: "Seguimiento" };

const SECTIONS = [
  { key: "vencidos", title: "Formación vencida", hint: "Fecha límite superada sin completar el curso.", dateLabel: "Fecha límite", tone: "danger", subject: "Tienes formación pendiente fuera de plazo" },
  { key: "proximos", title: "Vencen en los próximos 7 días", hint: "Cursos con fecha límite cercana.", dateLabel: "Fecha límite", tone: "warn", subject: "Recordatorio: tu formación vence pronto" },
  { key: "sin_empezar", title: "Inscritos sin empezar", hint: "Más de 7 días inscritos sin abrir el curso.", dateLabel: "Inscripción", tone: "warn", subject: "Tienes un curso pendiente de empezar" },
  { key: "estancados", title: "Sin avanzar", hint: "En curso pero sin acceder en los últimos 14 días.", dateLabel: "Último acceso", tone: "", subject: "Retoma tu formación en Tuio Academy" },
  { key: "sin_acceso", title: "Nunca han entrado", hint: "Alumnos activos que todavía no han iniciado sesión.", dateLabel: "Alta", tone: "grey", subject: "Activa tu cuenta de Tuio Academy" },
] as const;

export default async function Seguimiento() {
  const data = followUps();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Seguimiento</span> de alumnos
          </h1>
          <p className="muted" style={{ margin: 0 }}>Quién necesita un recordatorio. «Escribir» abre tu correo con los alumnos en copia oculta.</p>
        </div>
      </div>
      <div className="kpis" style={{ marginBottom: 16 }}>
        {SECTIONS.slice(0, 4).map((s) => (
          <a key={s.key} href={`#${s.key}`} className="kpi" style={{ textDecoration: "none" }}>
            <b style={{ color: s.tone === "danger" && data[s.key].length ? "var(--danger)" : undefined }}>{data[s.key].length}</b>
            <span>{s.title}</span>
          </a>
        ))}
      </div>
      {SECTIONS.map((s) => {
        const rows: FollowUpRow[] = data[s.key];
        const emails = [...new Set(rows.map((r) => r.email))];
        return (
          <div className="card" id={s.key} key={s.key}>
            <div className="card-title">
              <div>
                <h3 style={{ marginBottom: 2 }}>{s.title} <span className={`badge ${s.tone}`}>{rows.length}</span></h3>
                <span className="small muted">{s.hint}</span>
              </div>
              {emails.length > 0 && (
                <div className="actions">
                  <CopyButton text={emails.join(", ")} label="Copiar emails" />
                  <a className="btn sm" href={`mailto:?bcc=${emails.join(",")}&subject=${encodeURIComponent(s.subject)}`}>Escribir ({emails.length})</a>
                </div>
              )}
            </div>
            {rows.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Nadie en esta situación.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Alumno</th><th>Departamento</th>{s.key !== "sin_acceso" && <th>Curso</th>}<th>{s.dateLabel}</th></tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td><Link href={`/admin/usuarios/${r.user_id}`}>{r.last_name}, {r.first_name}</Link><div className="small muted">{r.email}</div></td>
                        <td>{r.department ?? "—"}</td>
                        {s.key !== "sin_acceso" && <td>{r.course}</td>}
                        <td className="nowrap">{formatDate(r.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
