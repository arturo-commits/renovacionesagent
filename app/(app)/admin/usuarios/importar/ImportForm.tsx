"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importUsers } from "../actions";
import { CopyButton } from "@/components/CopyButton";

const RESULT_BADGE = { creado: "ok", actualizado: "", omitido: "grey", error: "danger" } as const;

export function ImportForm() {
  const [state, action, pending] = useActionState(importUsers, undefined);
  const rows = state?.rows ?? [];
  const count = (r: string) => rows.filter((x) => x.result === r).length;
  const links = rows.filter((r) => r.link);

  return (
    <>
      <form action={action} className="form">
        {state?.error && <div className="alert error">{state.error}</div>}
        <div className="field">
          <label>Fichero CSV</label>
          <input className="input" type="file" name="file" accept=".csv,text/csv,text/plain" />
        </div>
        <div className="field">
          <label>…o pega el contenido</label>
          <textarea className="input" name="text" placeholder={"nombre;apellidos;email;departamento;cursos\nAna;Martín López;ana.martin@tuio.com;Siniestros;seguro-hogar|seguro-auto"} style={{ minHeight: 140 }} />
        </div>
        <label className="check"><input type="checkbox" name="invite" defaultChecked /> Generar enlace de activación para las cuentas nuevas</label>
        <label className="check"><input type="checkbox" name="update" /> Actualizar los alumnos que ya existen (mismo email)</label>
        <div className="actions">
          <button className="btn" disabled={pending}>{pending ? "Importando…" : "Importar"}</button>
        </div>
      </form>

      {rows.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi"><b>{count("creado")}</b><span>Creados</span></div>
            <div className="kpi"><b>{count("actualizado")}</b><span>Actualizados</span></div>
            <div className="kpi"><b>{count("omitido")}</b><span>Omitidos</span></div>
            <div className="kpi"><b style={{ color: count("error") ? "var(--danger)" : undefined }}>{count("error")}</b><span>Con errores</span></div>
          </div>
          {links.length > 0 && (
            <div className="alert info actions" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <span>Se han generado {links.length} enlaces de activación (válidos 14 días). Envíaselos a cada alumno.</span>
              <CopyButton text={links.map((l) => `${l.name} <${l.email}>: ${l.link}`).join("\n")} label="Copiar enlaces" />
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Fila</th><th>Alumno</th><th>Resultado</th><th>Detalle</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line}>
                    <td className="muted">{r.line}</td>
                    <td>{r.name || "—"}<div className="small muted">{r.email}</div></td>
                    <td><span className={`badge ${RESULT_BADGE[r.result]}`}>{r.result}</span></td>
                    <td className="small">{r.message}{r.link && <div><code style={{ wordBreak: "break-all" }}>{r.link}</code></div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 16 }}><Link href="/admin/usuarios">Ver alumnos</Link></p>
        </div>
      )}
    </>
  );
}
