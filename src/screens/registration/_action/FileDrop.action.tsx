"use client";
import type { ReactNode } from "react";
import { useRegistrationHandler } from "../_handler/Registration.handler";
export function FileDropAction({ children }: { children: ReactNode }) {
  const { busy, reading, ingest } = useRegistrationHandler();
  return (
    <div
      className="registration-page"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!busy && !reading) void ingest(Array.from(e.dataTransfer.files));
      }}
    >
      {children}
    </div>
  );
}
