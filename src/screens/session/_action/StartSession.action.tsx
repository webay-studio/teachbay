"use client";
import type { ReactNode } from "react";
import { useSessionHandler } from "../_handler/Session.handler";
export function StartSessionAction({
  children,
  className = "btn primary",
}: {
  children: ReactNode;
  className?: string;
}) {
  const { start } = useSessionHandler();
  return (
    <button className={className} onClick={start}>
      {children}
    </button>
  );
}
