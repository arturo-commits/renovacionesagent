# Tuio Academy

Plataforma de formación interna sobre los seguros de Tuio (Hogar, Auto, Mascotas, Vida).
Primera versión de la estructura: todavía **sin documentación real**; las unidades llevan contenido de marcador.

## Qué incluye

**Alumnado**
- Registro (nombre, apellidos, email, NIF/NIE, teléfono, empresa, departamento, puesto, consentimiento RGPD) e inicio de sesión.
- Inicio: resumen (cursos, pendientes, completados, tiempo), «continúa donde lo dejaste», formación obligatoria y actividad reciente.
- Catálogo por ramo e inscripción en cursos. Los cursos obligatorios se asignan automáticamente al darse de alta.
- Curso → módulos → unidades (lectura, vídeo, documento, test). Pestañas de contenido, progreso, calificaciones y registro de actividad.
- Visor de unidades con índice, «marcar como completada», anterior/siguiente y registro del tiempo de dedicación (pulso cada 30 s con la pestaña visible).
- Test con nota mínima, varios intentos y corrección.
- Certificado imprimible / PDF al completar el curso (todas las unidades y el test aprobado).
- Mi expediente: inscripciones, fechas de inscripción, primer y último acceso, finalización, dedicación, nota y log completo de actividad.

**Gestión** (roles `tutor` y `admin`)
- Panel con indicadores, estadísticas por curso y resumen de alumnos que requieren atención.
- Alumnos:
  - Listado con búsqueda, filtros por estado (vencidos, obligatoria pendiente, sin activar, sin actividad 30 días, al día…), departamento, curso, grupo y rol; orden por columnas, paginación y exportación CSV.
  - Acciones en bloque: inscribir (con fecha límite), añadir a grupo, generar enlaces de activación, dar de baja de curso, activar y desactivar.
  - Alta individual sin contraseña: se genera un enlace de activación (14 días) para que el alumno cree la suya y acepte el tratamiento de datos.
  - Importación masiva desde CSV (plantilla descargable) con cursos, grupo y fecha límite por fila, informe de resultados y enlaces de activación.
  - Ficha: expediente con fechas límite editables, horas certificadas, grupos, notas internas del equipo, actividad con IP, edición de datos y expediente en PDF.
- Grupos / convocatorias: alumnos + cursos + fechas (la fecha de fin es la fecha límite), tutor, matriz de seguimiento y «escribir al grupo».
- Seguimiento: formación vencida, que vence en 7 días, inscritos sin empezar, sin avanzar y nunca han entrado, con copia de emails y redacción del correo en copia oculta.
- Cursos: crear, editar datos, publicar/borrador, obligatorio, nota mínima; módulos y unidades (añadir, renombrar, reordenar, borrar); edición de contenido, URL de vídeo/documento y preguntas del test (JSON). Inscripción masiva por departamento.
- Informes del registro de formación con filtros y exportación CSV (compatible con Excel).

## Roles

| Rol | Para quién | Qué controla |
|---|---|---|
| **Superadministración** | Responsable de la plataforma (`formacion@tuio.com`) | Todo: además nombra administradores, cambia cualquier rol y puede eliminar datos. Siempre queda al menos una cuenta con este rol. |
| **Administración de formación** | Equipo que controla la información | Alumnos (altas, importación, datos, activación), cursos y contenidos, grupos, informes, correo y seguimiento. Puede añadir personas de Seguimiento. |
| **Seguimiento** | Responsables de área / tutores | Consulta alumnos e informes, envía recordatorios e invitaciones, gestiona fechas límite, notas e inscripciones. Se puede limitar a uno o varios departamentos. |
| **Alumno/a** | Plantilla en formación | Su propia formación. |

El equipo se gestiona en **Gestión → Equipo y roles**, donde también está la tabla completa de permisos (`lib/permissions.ts`).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # opcional: cambia la contraseña del administrador
npm run dev                  # http://localhost:3000
```

`APP_URL` (opcional) fija la URL base de los enlaces de activación; si no, se usa la del navegador.

Al arrancar por primera vez se crea `data/tuio-academy.db` (SQLite) con 5 cursos de ejemplo y el usuario administrador
`formacion@tuio.com` / `CambiaEsto-2026` con rol de Superadministración (o los valores de `ADMIN_EMAIL` / `ADMIN_PASSWORD`). **Cámbiala tras el primer acceso.**

`npm run db:reset` borra la base de datos para volver a empezar.

## Correo desde formacion@tuio.com

La plataforma envía desde la cuenta de formación: invitaciones de activación, recuperación de contraseña, avisos de inscripción,
aviso de curso completado y recordatorios (vence pronto, fuera de plazo, sin empezar). Todo queda en **Gestión → Correo**,
donde también se puede enviar un correo de prueba y lanzar los recordatorios a mano.

1. Crear la cuenta `formacion@tuio.com` (Google Workspace u otro proveedor).
2. Con Google Workspace: activar la verificación en dos pasos en esa cuenta y crear una **contraseña de aplicación**
   (o usar el servicio de retransmisión SMTP de Workspace).
3. Configurar en el servidor las variables `SMTP_*`, `MAIL_FROM`, `APP_URL` y `CRON_SECRET` (ver `.env.example`).
4. Programar el cron diario de recordatorios, por ejemplo a las 8:45 de lunes a viernes:
   ```
   45 8 * * 1-5  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://academy.tuio.com/api/cron/recordatorios
   ```
5. Recomendado: configurar SPF, DKIM y DMARC del dominio para que los correos no acaben en spam.

Para probar sin enviar nada: `MAIL_TRANSPORT=log` guarda cada correo como `.eml` en `data/outbox`.

## Stack

Next.js 16 (App Router, server actions) · React 19 · SQLite (`better-sqlite3`) · sesiones propias con cookie httpOnly y contraseñas con bcrypt.
Sin dependencias de UI: estilos en `app/globals.css` con la identidad de Tuio (Poppins, navy `#2E566C`, cian `#1CC6D0`, motivo de tres puntos).
Las ilustraciones de `public/illustrations` proceden de la biblioteca oficial de Tuio en Drive (Mapachín, Auto, Mascotas); Hogar y Vida usan de momento trazos genéricos de reserva.

## Estructura

```
app/(auth)/            login, registro y acciones de sesión
app/(app)/             área privada (inicio, mis-cursos, catálogo, cursos, expediente, certificados, perfil)
app/(app)/admin/       gestión (panel, usuarios, cursos, informes)
app/certificado/[id]   certificado imprimible
app/api/               heartbeat de tiempo y exportación CSV
lib/                   base de datos, datos iniciales, autenticación y lógica de progreso
```

## Próximos pasos sugeridos

- Cargar la documentación real de cada producto (texto, vídeos, condicionados) y las preguntas definitivas de los tests.
- Ilustraciones oficiales para Hogar y Vida.
- Recuperación de contraseña por email y/o SSO con Google Workspace.
- Foro/mensajes con el tutor, encuestas de satisfacción y subida de ficheros (SCORM si se necesitara).
