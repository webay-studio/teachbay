"use client";
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const RegistrationHeaderContext = createContext<
  HTMLElement | null | undefined
>(undefined);

export function RegistrationHeaderActions({
  children,
}: {
  children: ReactNode;
}) {
  const target = useContext(RegistrationHeaderContext);
  if (target === undefined) return <>{children}</>;
  return target ? createPortal(children, target) : null;
}
