// Plantillas de correo con la identidad de Tuio. HTML con estilos en línea para los clientes de correo.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Mail = { subject: string; html: string; text: string };

function layout(opts: { title: string; intro: string[]; items?: string[]; cta?: { label: string; url: string }; foot?: string }): string {
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2E566C">${t}</p>`;
  return `<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#F6F9FB">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F9FB;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;font-family:Poppins,Segoe UI,Helvetica,Arial,sans-serif">
<tr><td style="padding:28px 32px 8px">
  <span style="font-size:26px;font-weight:700;color:#2E566C;letter-spacing:-0.5px">tu<span style="color:#1CC6D0">io</span></span>
  <span style="font-size:12px;letter-spacing:0.6px;text-transform:uppercase;color:#718096;margin-left:6px">Academy</span>
  <div style="margin-top:10px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1CC6D0"></span>
  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#1CC6D0;margin-left:4px"></span>
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;border:1.5px solid #1CC6D0;margin-left:4px"></span></div>
</td></tr>
<tr><td style="padding:16px 32px 8px">
  <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#2E566C;font-weight:600">${opts.title}</h1>
  ${opts.intro.map(p).join("")}
  ${opts.items?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">${opts.items
    .map((i) => `<tr><td style="padding:10px 14px;background:#E6F8FA;border-radius:8px;font-size:14px;color:#2E566C">${i}</td></tr><tr><td style="height:6px"></td></tr>`)
    .join("")}</table>` : ""}
  ${opts.cta ? `<p style="margin:8px 0 22px"><a href="${opts.cta.url}" style="display:inline-block;background:#1CC6D0;color:#1F3D4F;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">${opts.cta.label}</a></p>
  <p style="margin:0 0 14px;font-size:12px;color:#718096">Si el botón no funciona, copia este enlace en tu navegador:<br><span style="word-break:break-all">${opts.cta.url}</span></p>` : ""}
</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #E2E8F0;font-size:12px;color:#718096;line-height:1.5">
  ${opts.foot ?? "Este mensaje lo envía el equipo de formación de Tuio. Si tienes dudas, responde a este correo."}
</td></tr>
</table></td></tr></table></body></html>`;
}

function text(lines: (string | undefined | null | false)[]): string {
  return lines.filter(Boolean).join("\n\n") + "\n\n— Equipo de formación de Tuio";
}

export function invitationMail(name: string, url: string): Mail {
  const title = `Hola, ${esc(name)}: ya tienes acceso a Tuio Academy`;
  return {
    subject: "Activa tu cuenta de Tuio Academy",
    html: layout({
      title,
      intro: [
        "Te hemos dado de alta en <b>Tuio Academy</b>, la plataforma de formación sobre los seguros de Tuio.",
        "Para empezar, crea tu contraseña con el botón de abajo. El enlace es personal y caduca en 14 días.",
      ],
      cta: { label: "Activar mi cuenta", url },
    }),
    text: text([`Hola, ${name}:`, "Te hemos dado de alta en Tuio Academy. Crea tu contraseña aquí (caduca en 14 días):", url]),
  };
}

export function resetMail(name: string, url: string): Mail {
  return {
    subject: "Restablece tu contraseña de Tuio Academy",
    html: layout({
      title: "Restablecer contraseña",
      intro: [`Hola, ${esc(name)}. Hemos recibido una solicitud para cambiar tu contraseña.`, "El enlace caduca en 2 horas. Si no lo has pedido tú, ignora este mensaje."],
      cta: { label: "Crear nueva contraseña", url },
    }),
    text: text([`Hola, ${name}:`, "Para crear una nueva contraseña entra aquí (caduca en 2 horas):", url, "Si no lo has pedido tú, ignora este mensaje."]),
  };
}

export function enrollmentMail(name: string, courses: string[], due: string | null, url: string): Mail {
  const dueTxt = due ? ` Tienes hasta el <b>${due}</b> para completarl${courses.length > 1 ? "os" : "o"}.` : "";
  return {
    subject: courses.length > 1 ? "Tienes nuevos cursos en Tuio Academy" : `Nuevo curso: ${courses[0]}`,
    html: layout({
      title: courses.length > 1 ? "Tienes nuevos cursos asignados" : "Tienes un nuevo curso asignado",
      intro: [`Hola, ${esc(name)}. El equipo de formación te ha inscrito en:`],
      items: courses.map(esc),
      cta: { label: "Ir a mis cursos", url },
      foot: (dueTxt ? dueTxt.trim() + "<br>" : "") + "Este mensaje lo envía el equipo de formación de Tuio.",
    }),
    text: text([`Hola, ${name}:`, "Te hemos inscrito en:", courses.map((c) => `- ${c}`).join("\n"), due && `Fecha límite: ${due}.`, url]),
  };
}

export type ReminderItem = { course: string; kind: "vencido" | "vence_pronto" | "sin_empezar" | "sin_avanzar" | "manual"; date?: string | null };

const ITEM_TXT: Record<ReminderItem["kind"], (i: ReminderItem) => string> = {
  vencido: (i) => `${i.course} — <b>fuera de plazo</b> desde el ${i.date}`,
  vence_pronto: (i) => `${i.course} — vence el <b>${i.date}</b>`,
  sin_empezar: (i) => `${i.course} — pendiente de empezar`,
  sin_avanzar: (i) => `${i.course} — sin avances recientes`,
  manual: (i) => `${i.course}${i.date ? ` — fecha límite ${i.date}` : ""}`,
};

export function reminderMail(name: string, items: ReminderItem[], url: string): Mail {
  const overdue = items.some((i) => i.kind === "vencido");
  return {
    subject: overdue ? "Tienes formación fuera de plazo" : "Recordatorio: tienes formación pendiente",
    html: layout({
      title: overdue ? "Tienes formación fuera de plazo" : "Tienes formación pendiente",
      intro: [`Hola, ${esc(name)}. Te recordamos que tienes pendiente:`],
      items: items.map((i) => ITEM_TXT[i.kind]({ ...i, course: esc(i.course) })),
      cta: { label: "Continuar mi formación", url },
    }),
    text: text([`Hola, ${name}:`, "Tienes pendiente:", items.map((i) => "- " + ITEM_TXT[i.kind](i).replace(/<\/?b>/g, "")).join("\n"), url]),
  };
}

export function completionMail(name: string, course: string, url: string): Mail {
  return {
    subject: `¡Enhorabuena! Has completado «${course}»`,
    html: layout({
      title: "¡Curso completado!",
      intro: [`Enhorabuena, ${esc(name)}. Has completado <b>${esc(course)}</b>.`, "Ya puedes descargar tu certificado."],
      cta: { label: "Ver mi certificado", url },
    }),
    text: text([`Enhorabuena, ${name}:`, `Has completado «${course}». Descarga tu certificado aquí:`, url]),
  };
}

export function testMail(name: string): Mail {
  return {
    subject: "Prueba de correo de Tuio Academy",
    html: layout({ title: "Correo de prueba", intro: [`Hola, ${esc(name)}. Si lees esto, el envío desde la cuenta de formación funciona correctamente.`] }),
    text: text([`Hola, ${name}:`, "Si lees esto, el envío desde la cuenta de formación funciona correctamente."]),
  };
}
