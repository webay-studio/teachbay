"use client";
import { useShallow } from "zustand/react/shallow";
import { useRef } from "react";
import { createScreenStore } from "@/_state/createScreenStore";
import type { RegistrationState } from "../_model/registration.model";
const { Provider, useScreenStore } = createScreenStore<RegistrationState>(
  (set) => ({
    rows: [],
    setRows: (value) =>
      set((state) => ({
        rows: typeof value === "function" ? value(state.rows) : value,
      })),
    errors: [],
    setErrors: (value) =>
      set((state) => ({
        errors: typeof value === "function" ? value(state.errors) : value,
      })),
    busy: false,
    setBusy: (value) =>
      set((state) => ({
        busy: typeof value === "function" ? value(state.busy) : value,
      })),
    reading: 0,
    setReading: (value) =>
      set((state) => ({
        reading: typeof value === "function" ? value(state.reading) : value,
      })),
    crop: undefined,
    setCrop: (value) =>
      set((state) => ({
        crop: typeof value === "function" ? value(state.crop) : value,
      })),
    documents: [],
    setDocuments: (value) =>
      set((state) => ({
        documents: typeof value === "function" ? value(state.documents) : value,
      })),
    reviewId: undefined,
    setReviewId: (value) =>
      set((state) => ({
        reviewId: typeof value === "function" ? value(state.reviewId) : value,
      })),
    progress: undefined,
    setProgress: (value) =>
      set((state) => ({
        progress: typeof value === "function" ? value(state.progress) : value,
      })),
  }),
);
export {
  Provider as RegistrationStoreProvider,
  useScreenStore as useRegistrationStore,
};
export function useRegistrationState() {
  const state = useScreenStore(useShallow((state) => ({ ...state })));
  const documentsRef = useRef(state.documents);
  documentsRef.current = state.documents;
  const importing = useRef(false);
  const cancel = useRef<AbortController | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  return { ...state, documentsRef, importing, cancel, input };
}
