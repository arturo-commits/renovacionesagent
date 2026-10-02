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
- Panel con indicadores y estadísticas por curso.
- Usuarios: búsqueda, alta, ficha con expediente y actividad (con IP), inscripción y baja en cursos, rol, activación y cambio de contraseña.
- Cursos: crear, editar datos, publicar/borrador, obligatorio, nota mínima; módulos y unidades (añadir, renombrar, reordenar, borrar); edición de contenido, URL de vídeo/documento y preguntas del test (JSON). Inscripción masiva por departamento.
- Informes del registro de formación con filtros y exportación CSV (compatible con Excel).

Los tutores pueden consultar e inscribir; solo `admin` edita contenidos, roles y bajas.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # opcional: cambia la contraseña del administrador
npm run dev                  # http://localhost:3000
```

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
- Recuperación de contraseña por email y/o SSO con Google Workspace.
- Fechas de convocatoria, avisos por email y recordatorios de formación obligatoria.
- Foro/mensajes con el tutor, encuestas de satisfacción y subida de ficheros (SCORM si se necesitara).
