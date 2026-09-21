"use client";
import { useShallow } from "zustand/react/shallow";
import { useRef } from "react";
import { createScreenStore } from "@/_state/createScreenStore";
import type { EditorState } from "../_model/editor.model";
const { Provider, useScreenStore } = createScreenStore<EditorState>((set) => ({
  value: undefined,
  setValue: (value) =>
    set((state) => ({
      value: typeof value === "function" ? value(state.value) : value,
    })),
  error: "",
  setError: (value) =>
    set((state) => ({
      error: typeof value === "function" ? value(state.error) : value,
    })),
  advanced: false,
  setAdvanced: (value) =>
    set((state) => ({
      advanced: typeof value === "function" ? value(state.advanced) : value,
    })),
  busy: false,
  setBusy: (value) =>
    set((state) => ({
      busy: typeof value === "function" ? value(state.busy) : value,
    })),
  status: "",
  setStatus: (value) =>
    set((state) => ({
      status: typeof value === "function" ? value(state.status) : value,
    })),
  drag: undefined,
  setDrag: (value) =>
    set((state) => ({
      drag: typeof value === "function" ? value(state.drag) : value,
    })),
}));
export { Provider as EditorStoreProvider, useScreenStore as useEditorStore };
export function useEditorState() {
  const state = useScreenStore(useShallow((state) => ({ ...state })));
  const queue = useRef(Promise.resolve());
  return { ...state, queue };
}
