"use client";
import { useShallow } from "zustand/react/shallow";
import { createScreenStore } from "@/_state/createScreenStore";
import type { QuestionsState } from "../_model/questions.model";
const { Provider, useScreenStore } = createScreenStore<QuestionsState>(
  (set) => ({
    rows: [],
    setRows: (value) =>
      set((state) => ({
        rows: typeof value === "function" ? value(state.rows) : value,
      })),
    loading: true,
    setLoading: (value) =>
      set((state) => ({
        loading: typeof value === "function" ? value(state.loading) : value,
      })),
    query: "",
    setQuery: (value) =>
      set((state) => ({
        query: typeof value === "function" ? value(state.query) : value,
      })),
    selected: [],
    setSelected: (value) =>
      set((state) => ({
        selected: typeof value === "function" ? value(state.selected) : value,
      })),
    zoom: undefined,
    setZoom: (value) =>
      set((state) => ({
        zoom: typeof value === "function" ? value(state.zoom) : value,
      })),
    edit: undefined,
    setEdit: (value) =>
      set((state) => ({
        edit: typeof value === "function" ? value(state.edit) : value,
      })),
    menu: undefined,
    setMenu: (value) =>
      set((state) => ({
        menu: typeof value === "function" ? value(state.menu) : value,
      })),
    error: "",
    setError: (value) =>
      set((state) => ({
        error: typeof value === "function" ? value(state.error) : value,
      })),
    busy: false,
    setBusy: (value) =>
      set((state) => ({
        busy: typeof value === "function" ? value(state.busy) : value,
      })),
  }),
);
export {
  Provider as QuestionsStoreProvider,
  useScreenStore as useQuestionsStore,
};
export function useQuestionsState() {
  const state = useScreenStore(useShallow((state) => ({ ...state })));

  return { ...state };
}
