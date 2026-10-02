"use client";

import type { ReactNode } from "react";

/** Botón de envío que pide confirmación antes de una acción destructiva. */
export function ConfirmButton({ message, className = "btn sm danger", children, label }: { message: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <button
      className={className}
      aria-label={label}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
