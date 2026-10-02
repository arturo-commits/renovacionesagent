"use client";

import { useActionState } from "react";
import type { Course, Unit } from "@/lib/learning";
import { updateCourse, updateUnit } from "../../actions";

const PRODUCTS = { general: "Tuio", hogar: "Hogar", auto: "Auto", mascotas: "Mascotas", vida: "Vida" };
const TYPES = { lectura: "Lectura", video: "Vídeo", documento: "Documento", test: "Test" };

export function CourseForm({ course }: { course: Course }) {
  const [state, action, pending] = useActionState(updateCourse.bind(null, course.id), undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      <div className="field"><label>Título</label><input className="input" name="title" defaultValue={course.title} required /></div>
      <div className="field"><label>Subtítulo</label><input className="input" name="subtitle" defaultValue={course.subtitle ?? ""} /></div>
      <div className="field">
        <label>Descripción</label>
        <textarea className="input" name="description" defaultValue={course.description ?? ""} style={{ minHeight: 100, fontFamily: "inherit" }} />
      </div>
      <div className="form-row">
        <div className="field">
          <label>Ramo</label>
          <select className="input" name="product" defaultValue={course.product}>
            {Object.entries(PRODUCTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>Horas</label><input className="input" name="hours" type="number" step="0.5" min="0.5" defaultValue={course.hours} /></div>
      </div>
      <div className="form-row">
        <div className="field"><label>Modalidad</label><input className="input" name="modality" defaultValue={course.modality} /></div>
        <div className="field"><label>Nota mínima</label><input className="input" name="passing_score" type="number" min="0" max="100" defaultValue={course.passing_score} /></div>
      </div>
      <label className="check"><input type="checkbox" name="mandatory" defaultChecked={!!course.mandatory} /> Obligatorio (se inscribe automáticamente a las nuevas altas)</label>
      <label className="check"><input type="checkbox" name="published" defaultChecked={!!course.published} /> Publicado en el catálogo</label>
      <button className="btn" disabled={pending}>Guardar curso</button>
    </form>
  );
}

export function UnitForm({ courseId, unit }: { courseId: number; unit: Unit }) {
  const [state, action, pending] = useActionState(updateUnit.bind(null, courseId, unit.id), undefined);
  return (
    <form action={action} className="form">
      {state?.error && <div className="alert error">{state.error}</div>}
      {state?.ok && <div className="alert ok">{state.ok}</div>}
      <div className="field"><label>Título</label><input className="input" name="title" defaultValue={unit.title} required /></div>
      <div className="form-row">
        <div className="field">
          <label>Tipo</label>
          <select className="input" name="type" defaultValue={unit.type}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label>Duración (min)</label><input className="input" name="duration_min" type="number" min="1" defaultValue={unit.duration_min} /></div>
      </div>
      <div className="field">
        <label>URL del recurso</label>
        <input className="input" name="resource_url" defaultValue={unit.resource_url ?? ""} placeholder="https://… (vídeo embebible o documento)" />
        <span className="hint">Para vídeos usa la URL de inserción (p. ej. YouTube /embed/… o Vimeo player). Para documentos, un enlace a Drive o PDF.</span>
      </div>
      <div className="field">
        <label>Contenido</label>
        <textarea className="input" name="content" defaultValue={unit.content ?? ""} />
        <span className="hint">Formato: «## Título», líneas que empiezan por «- » para listas, **negrita**, línea en blanco entre párrafos.</span>
      </div>
      {unit.type === "test" && (
        <div className="field">
          <label>Preguntas del test (JSON)</label>
          <textarea className="input" name="quiz_json" defaultValue={JSON.stringify(JSON.parse(unit.quiz_json || "[]"), null, 2)} style={{ minHeight: 260 }} />
          <span className="hint">{'[{"q": "Pregunta", "options": ["A", "B", "C"], "correct": 0}] — "correct" es el índice (0 = primera opción).'}</span>
        </div>
      )}
      <button className="btn" disabled={pending}>Guardar unidad</button>
    </form>
  );
}
