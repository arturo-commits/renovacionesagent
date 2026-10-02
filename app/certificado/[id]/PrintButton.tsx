"use client";

export function PrintButton() {
  return (
    <button className="btn sm" onClick={() => window.print()}>
      Descargar PDF / Imprimir
    </button>
  );
}
