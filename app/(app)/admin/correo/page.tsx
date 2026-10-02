import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/learning";
import { mailConfig } from "@/lib/mail";
import { RunReminders, TestForm } from "./forms";

export const metadata = { title: "Correo" };

const KIND_LABEL: Record<string, string> = {
  invitacion: "Invitación", reset: "Restablecer contraseña", inscripcion: "Aviso de inscripción", recordatorio: "Recordatorio",
  certificado: "Curso completado", prueba: "Prueba",
};
const STATUS: Record<string, [string, string]> = {
  enviado: ["Enviado", "ok"], simulado: ["Simulado", ""], error: ["Error", "danger"], sin_configurar: ["Sin configurar", "grey"],
};

export default async function Correo({ searchParams }: { searchParams: Promise<{ estado?: string; tipo?: string }> }) {
  const staff = await requirePerm("correo.gestionar");
  const sp = await searchParams;
  const c = mailConfig();
  const where: string[] = [];
  const args: string[] = [];
  if (sp.estado) { where.push("l.status = ?"); args.push(sp.estado); }
  if (sp.tipo) { where.push("l.kind = ?"); args.push(sp.tipo); }
  const log = getDb()
    .prepare(
      `SELECT l.*, u.first_name || ' ' || u.last_name AS user_name, s.first_name || ' ' || s.last_name AS sender
       FROM email_log l LEFT JOIN users u ON u.id = l.user_id LEFT JOIN users s ON s.id = l.sent_by
       ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY l.id DESC LIMIT 200`
    )
    .all(...args) as { id: number; to_email: string; user_id: number | null; user_name: string | null; kind: string; subject: string; status: string; error: string | null; sender: string | null; created_at: string }[];
  const stats = getDb()
    .prepare("SELECT status, COUNT(*) AS n FROM email_log WHERE created_at > datetime('now', '-30 days') GROUP BY status")
    .all() as { status: string; n: number }[];
  const n = (st: string) => stats.find((x) => x.status === st)?.n ?? 0;
  const modeLabel = { smtp: "Envío real (SMTP)", log: "Simulado (se guardan en data/outbox)", off: "Sin configurar" }[c.mode];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="accent">Correo</span> de formación
          </h1>
          <p className="muted" style={{ margin: 0 }}>Invitaciones, avisos y recordatorios que se envían desde la cuenta de formación.</p>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><b>{n("enviado")}</b><span>Enviados (30 días)</span></div>
        <div className="kpi"><b style={{ color: n("error") ? "var(--danger)" : undefined }}>{n("error")}</b><span>Con error (30 días)</span></div>
        <div className="kpi"><b>{n("simulado")}</b><span>Simulados (30 días)</span></div>
        <div className="kpi"><b>{n("sin_configurar")}</b><span>No enviados por falta de configuración</span></div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-title">
            <h3>Configuración</h3>
            <span className={`badge ${c.mode === "smtp" ? "ok" : c.mode === "log" ? "" : "danger"}`}>{modeLabel}</span>
          </div>
          <table className="table small">
            <tbody>
              <tr><td className="muted">Remitente</td><td><b>{c.from}</b></td></tr>
              <tr><td className="muted">Servidor SMTP</td><td>{c.host ? `${c.host}:${c.port}${c.secure ? " (SSL)" : " (STARTTLS)"}` : "—"}</td></tr>
              <tr><td className="muted">Usuario</td><td>{c.user || "—"}</td></tr>
              <tr><td className="muted">Contraseña</td><td>{c.hasPassword ? "Configurada" : "—"}</td></tr>
              <tr><td className="muted">Responder a</td><td>{c.replyTo ?? "El remitente"}</td></tr>
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 12 }}>
            Se configura en las variables de entorno del servidor (<code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code>, <code>MAIL_FROM</code>). Ver README.
          </p>
          <h3 style={{ marginTop: 16 }}>Enviar correo de prueba</h3>
          <TestForm defaultTo={staff.email} />
        </div>
        <div className="card">
          <h3>Recordatorios automáticos</h3>
          <p className="small">Cada día el servidor revisa las inscripciones y envía un único correo por alumno con:</p>
          <ul className="small" style={{ paddingLeft: 18 }}>
            <li>Cursos que <b>vencen en los próximos 7 días</b> (una vez por fecha límite).</li>
            <li>Cursos <b>fuera de plazo</b> (como mucho una vez por semana).</li>
            <li>Cursos <b>sin empezar</b> 7 días después de la inscripción (una vez).</li>
          </ul>
          <p className="small muted">
            Además se avisa al alumno al inscribirlo (si se marca «Avisar») y al completar un curso. Las cuentas sin activar no reciben recordatorios: para ellas se reenvía la invitación desde <Link href="/admin/seguimiento">Seguimiento</Link>.
          </p>
          <p className="small muted">
            Programación en el servidor: <code>/api/cron/recordatorios</code> con la cabecera <code>Authorization: Bearer CRON_SECRET</code>
            {process.env.CRON_SECRET ? " (CRON_SECRET configurado)." : " — falta configurar CRON_SECRET."}
          </p>
          <RunReminders />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">
          <h3>Registro de envíos</h3>
          <form className="inline-form">
            <select className="input" name="tipo" defaultValue={sp.tipo ?? ""}>
              <option value="">Todos los tipos</option>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="input" name="estado" defaultValue={sp.estado ?? ""}>
              <option value="">Todos los estados</option>
              {Object.entries(STATUS).map(([k, [v]]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn sm ghost">Filtrar</button>
          </form>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Destinatario</th><th>Tipo</th><th>Asunto</th><th>Estado</th><th>Enviado por</th></tr></thead>
            <tbody>
              {log.length === 0 && <tr><td colSpan={6} className="muted">Todavía no se ha enviado ningún correo.</td></tr>}
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap small">{formatDate(l.created_at, true)}</td>
                  <td>{l.user_id ? <Link href={`/admin/usuarios/${l.user_id}`}>{l.user_name}</Link> : null}<div className="small muted">{l.to_email}</div></td>
                  <td className="small">{KIND_LABEL[l.kind] ?? l.kind}</td>
                  <td className="small">{l.subject}</td>
                  <td><span className={`badge ${STATUS[l.status]?.[1] ?? "grey"}`} title={l.error ?? ""}>{STATUS[l.status]?.[0] ?? l.status}</span>{l.error && <div className="small muted" style={{ maxWidth: 220 }}>{l.error}</div>}</td>
                  <td className="small">{l.sender ?? "Automático"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
