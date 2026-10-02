"use client";

import { useActionState } from "react";
import { submitQuiz, type QuizResult } from "@/app/(app)/actions";
import { Prose } from "@/components/Prose";

type Attempt = { score: number; passed: number; submitted_at: string };

export function QuizForm({
  unitId,
  questions,
  passing,
  intro,
  attempts,
  alreadyPassed,
}: {
  unitId: number;
  questions: { q: string; options: string[] }[];
  passing: number;
  intro: string | null;
  attempts: Attempt[];
  alreadyPassed: boolean;
}) {
  const [result, action, pending] = useActionState<QuizResult, FormData>(submitQuiz.bind(null, unitId), undefined);
  const best = attempts.reduce((m, a) => Math.max(m, a.score), -1);

  if (questions.length === 0) return <p className="muted">Este test todavía no tiene preguntas.</p>;

  return (
    <>
      <Prose text={intro} />
      <div className="actions small muted" style={{ marginBottom: 8 }}>
        <span>{questions.length} preguntas</span>·<span>Nota mínima {passing}/100</span>·<span>Intentos: {attempts.length}</span>
        {best >= 0 && (
          <>
            ·<span>Mejor nota: {best}</span>
          </>
        )}
      </div>
      {alreadyPassed && !result && <div className="alert ok">Ya has aprobado esta evaluación. Puedes repetirla si quieres repasar.</div>}
      {result && (
        <div className={`alert ${result.passed ? "ok" : "error"}`} style={{ marginTop: 12 }}>
          Has obtenido <b>{result.score}/100</b>. {result.passed ? "¡Evaluación superada!" : `Necesitas ${passing} para aprobar. Revisa el contenido y vuelve a intentarlo.`}
        </div>
      )}
      <form action={action} key={result ? attempts.length : "new"}>
        {questions.map((q, i) => (
          <fieldset className="question" key={i} style={{ border: 0, margin: 0, padding: "20px 0" }}>
            <h3>
              <span className="pill-num">{i + 1}</span>
              {q.q}
            </h3>
            {q.options.map((opt, j) => {
              const cls = result ? (j === result.correct[i] ? "right" : result.answers[i] === j ? "wrong" : "") : "";
              return (
                <label className={`option ${cls}`} key={j}>
                  <input type="radio" name={`q${i}`} value={j} required defaultChecked={result?.answers[i] === j} disabled={!!result} />
                  {opt}
                </label>
              );
            })}
          </fieldset>
        ))}
        {!result && (
          <button className="btn accent" disabled={pending}>
            {pending ? "Corrigiendo…" : "Enviar respuestas"}
          </button>
        )}
      </form>
      {result && (
        <button className="btn ghost" onClick={() => window.location.reload()}>
          Repetir test
        </button>
      )}
    </>
  );
}
