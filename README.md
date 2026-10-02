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

Los tutores pueden consultar e inscribir; solo `admin` edita contenidos, roles y bajas.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # opcional: cambia la contraseña del administrador
npm run dev                  # http://localhost:3000
```

`APP_URL` (opcional) fija la URL base de los enlaces de activación; si no, se usa la del navegador.

Al arrancar por primera vez se crea `data/tuio-academy.db` (SQLite) con 5 cursos de ejemplo y el usuario administrador
`formacion@tuio.com` / `CambiaEsto-2026` (o los valores de `ADMIN_EMAIL` / `ADMIN_PASSWORD`). **Cámbiala tras el primer acceso.**

`npm run db:reset` borra la base de datos para volver a empezar.

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
- Envío automático de invitaciones y recordatorios por email (necesita un servicio SMTP o similar); hoy los enlaces se copian y los correos se redactan desde el cliente de correo.
- Recuperación de contraseña por email y/o SSO con Google Workspace.
- Foro/mensajes con el tutor, encuestas de satisfacción y subida de ficheros (SCORM si se necesitara).
