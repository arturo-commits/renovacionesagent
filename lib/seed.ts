import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";

type SeedUnit = { title: string; type: "lectura" | "video" | "documento" | "test"; duration: number; content?: string };
type SeedModule = { title: string; description?: string; units: SeedUnit[] };
type SeedCourse = {
  slug: string; title: string; subtitle: string; description: string; product: string;
  hours: number; mandatory?: boolean; modules: SeedModule[];
};

const pendiente = (tema: string) =>
  `## ${tema}\n\nContenido pendiente de incorporar.\n\nEn esta unidad se incluirá la documentación oficial de Tuio sobre este tema. Mientras tanto, puedes marcarla como completada para probar el flujo de la plataforma.`;

// Preguntas de ejemplo: sirven para probar el flujo del test hasta que se cargue la documentación real.
const QUIZ_DEMO = JSON.stringify([
  {
    q: "Pregunta de ejemplo: ¿dónde puedes consultar tu progreso en un curso?",
    options: ["En la pestaña Progreso del curso", "No se puede consultar", "Solo lo ve el tutor"],
    correct: 0,
  },
  {
    q: "Pregunta de ejemplo: ¿qué necesitas para obtener el certificado?",
    options: ["Solo inscribirme", "Completar todas las unidades y aprobar la evaluación", "Conectarme una vez"],
    correct: 1,
  },
  {
    q: "Pregunta de ejemplo: ¿queda registrado el tiempo que dedicas a la formación?",
    options: ["Sí, en Mi expediente", "No"],
    correct: 0,
  },
]);

function productCourse(slug: string, product: string, nombre: string, hours: number, mandatory = false): SeedCourse {
  return {
    slug,
    product,
    hours,
    mandatory,
    title: `Seguro de ${nombre} Tuio`,
    subtitle: `Producto, coberturas y gestión del seguro de ${nombre.toLowerCase()}`,
    description: `Formación sobre el seguro de ${nombre.toLowerCase()} de Tuio: qué es, a quién va dirigido, qué cubre, cómo se contrata, cómo se renueva y cómo se gestionan los siniestros.`,
    modules: [
      {
        title: "Módulo 1. Presentación del producto",
        units: [
          { title: "Qué es y a quién va dirigido", type: "lectura", duration: 15 },
          { title: "Vídeo: el producto en 5 minutos", type: "video", duration: 5 },
        ],
      },
      {
        title: "Módulo 2. Coberturas y garantías",
        units: [
          { title: "Coberturas básicas", type: "lectura", duration: 20 },
          { title: "Coberturas opcionales y exclusiones", type: "lectura", duration: 20 },
          { title: "Condicionado general (documento)", type: "documento", duration: 15 },
        ],
      },
      {
        title: "Módulo 3. Contratación y renovación",
        units: [
          { title: "Proceso de contratación", type: "lectura", duration: 15 },
          { title: "Renovaciones y cambios en la póliza", type: "lectura", duration: 15 },
        ],
      },
      {
        title: "Módulo 4. Siniestros",
        units: [{ title: "Cómo se declara y gestiona un siniestro", type: "lectura", duration: 20 }],
      },
      {
        title: "Evaluación final",
        units: [{ title: "Test de evaluación", type: "test", duration: 15 }],
      },
    ],
  };
}

const COURSES: SeedCourse[] = [
  {
    slug: "bienvenida-tuio",
    product: "general",
    hours: 2,
    mandatory: true,
    title: "Bienvenida a Tuio",
    subtitle: "Quiénes somos, cómo trabajamos y cómo usar la plataforma",
    description: "Curso de acogida: historia y misión de Tuio, productos, cultura y funcionamiento de esta plataforma de formación.",
    modules: [
      {
        title: "Módulo 1. Conoce Tuio",
        units: [
          { title: "Nuestra historia y misión", type: "lectura", duration: 15 },
          { title: "Nuestros productos", type: "lectura", duration: 15 },
        ],
      },
      {
        title: "Módulo 2. Cómo funciona la plataforma",
        units: [
          {
            title: "Guía rápida de Tuio Academy",
            type: "lectura",
            duration: 10,
            content:
              "## Guía rápida\n\nCada curso se divide en módulos y cada módulo en unidades.\n\n- Abre una unidad desde el índice del curso.\n- Cuando termines de leerla, pulsa «Marcar como completada».\n- El test final se aprueba con la nota mínima indicada en el curso.\n- Al completar todas las unidades y aprobar el test, podrás descargar tu certificado.\n\nEl tiempo que pasas en cada unidad queda registrado en «Mi expediente».",
          },
        ],
      },
      { title: "Evaluación final", units: [{ title: "Test de evaluación", type: "test", duration: 10 }] },
    ],
  },
  productCourse("seguro-hogar", "hogar", "Hogar", 6, true),
  productCourse("seguro-auto", "auto", "Auto", 6),
  productCourse("seguro-mascotas", "mascotas", "Mascotas", 4),
  productCourse("seguro-vida", "vida", "Vida", 4),
];

export function seed(db: Database.Database) {
  const email = process.env.ADMIN_EMAIL || "formacion@tuio.com";
  const password = process.env.ADMIN_PASSWORD || "CambiaEsto-2026";

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (email, password_hash, first_name, last_name, company, department, job_title, role, consent_at)
       VALUES (?, ?, 'Equipo', 'Formación', 'Tuio', 'Personas', 'Administración de la formación', 'superadmin', datetime('now'))`
    ).run(email, bcrypt.hashSync(password, 10));

    const insCourse = db.prepare(
      `INSERT INTO courses (slug, title, subtitle, description, product, hours, mandatory) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insModule = db.prepare(`INSERT INTO modules (course_id, position, title, description) VALUES (?, ?, ?, ?)`);
    const insUnit = db.prepare(
      `INSERT INTO units (module_id, position, title, type, content, duration_min, quiz_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    for (const c of COURSES) {
      const courseId = insCourse.run(c.slug, c.title, c.subtitle, c.description, c.product, c.hours, c.mandatory ? 1 : 0)
        .lastInsertRowid;
      c.modules.forEach((m, mi) => {
        const moduleId = insModule.run(courseId, mi + 1, m.title, m.description ?? null).lastInsertRowid;
        m.units.forEach((u, ui) => {
          insUnit.run(
            moduleId,
            ui + 1,
            u.title,
            u.type,
            u.type === "test" ? "Responde a las preguntas. Necesitas la nota mínima del curso para aprobar." : u.content ?? pendiente(u.title),
            u.duration,
            u.type === "test" ? QUIZ_DEMO : null
          );
        });
      });
    }
  });
  tx();
}
