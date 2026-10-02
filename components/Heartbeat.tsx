"use client";

import { useEffect } from "react";

const INTERVAL = 30;

/** Registra el tiempo de dedicación mientras la pestaña está visible. */
export function Heartbeat({ unitId }: { unitId: number }) {
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, seconds: INTERVAL }),
        keepalive: true,
      }).catch(() => {});
    }, INTERVAL * 1000);
    return () => clearInterval(id);
  }, [unitId]);
  return null;
}
