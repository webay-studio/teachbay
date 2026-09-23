"use client";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

const Context = createContext<{
  stage: (files: File[]) => void;
  take: () => File[];
} | null>(null);

// Keep original files in memory only while moving into the registration route.
export function RegistrationIntakeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pending = useRef<File[]>([]);
  const value = useMemo(
    () => ({
      stage(files: File[]) {
        pending.current = files;
      },
      take() {
        const files = pending.current;
        pending.current = [];
        return files;
      },
    }),
    [],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRegistrationIntake() {
  const value = useContext(Context);
  if (!value) throw new Error("RegistrationIntakeProvider is missing.");
  return value;
}
