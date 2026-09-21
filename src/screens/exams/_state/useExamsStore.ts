"use client";
import { useShallow } from "zustand/react/shallow";
import { createScreenStore } from "@/_state/createScreenStore";
import type { ExamsState } from "../_model/exams.model";
const { Provider, useScreenStore } = createScreenStore<ExamsState>((set) => ({
  rows: [],
  setRows: (value) =>
    set((state) => ({
      rows: typeof value === "function" ? value(state.rows) : value,
    })),
  query: "",
  setQuery: (value) =>
    set((state) => ({
      query: typeof value === "function" ? value(state.query) : value,
    })),
  error: "",
  setError: (value) =>
    set((state) => ({
      error: typeof value === "function" ? value(state.error) : value,
    })),
  loading: true,
  setLoading: (value) =>
    set((state) => ({
      loading: typeof value === "function" ? value(state.loading) : value,
    })),
  busy: false,
  setBusy: (value) =>
    set((state) => ({
      busy: typeof value === "function" ? value(state.busy) : value,
    })),
}));
export { Provider as ExamsStoreProvider, useScreenStore as useExamsStore };
export function useExamsState() {
  const state = useScreenStore(useShallow((state) => ({ ...state })));

  return { ...state };
}
