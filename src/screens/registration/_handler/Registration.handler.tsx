"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { errorText } from "@engine/db";
import type {
  PendingQuestion,
  ImportedDocument,
} from "@engine/documents/types";
import { useRegistrationState } from "../_state/useRegistrationStore";
import {
  isDocument,
  readDocument,
  readImage,
  persist,
} from "../_lib/registration.lib";
function useRegistrationController() {
  const state = useRegistrationState();
  const {
    rows,
    setJobs,
    setRows,
    setErrors,
    busy,
    setBusy,
    setReading,
    setDocuments,
    documentsRef,
    reviewId,
    setReviewId,
    setProgress,
    importing,
    cancel,
  } = state;
  const router = useRouter();
  useEffect(
    () => () => {
      cancel.current?.abort();
    },
    [cancel],
  );
  async function ingest(files: File[]) {
    if (importing.current || busy || !files.length) return;
    const batch = files.map((file) => ({ file, id: crypto.randomUUID() }));
    setJobs((prev) => [
      ...prev,
      ...batch.map(({ file, id }) => ({
        id,
        name: file.name,
        state: "waiting" as const,
        previews: [],
      })),
    ]);
    importing.current = true;
    setReading(1);
    const controller = new AbortController();
    cancel.current = controller;
    try {
      for (const { file, id } of batch) {
        if (controller.signal.aborted) break;
        setJobs((prev) =>
          prev.map((j) => (j.id === id ? { ...j, state: "processing" } : j)),
        );
        const report = (
          progress: import("@engine/documents/types").ImportProgress,
        ) => {
          setProgress(progress);
          setJobs((prev) =>
            prev.map((j) => (j.id === id ? { ...j, progress } : j)),
          );
        };
        try {
          if (isDocument(file)) {
            const doc = await readDocument(file, report, controller.signal);
            if (controller.signal.aborted) break;
            setDocuments((prev) => [...prev, doc]);
            setReviewId((prev) => prev ?? doc.id);
            setJobs((prev) =>
              prev.map((j) =>
                j.id === id
                  ? { ...j, state: "ready", documentId: doc.id, previews: [] }
                  : j,
              ),
            );
          } else {
            report({
              current: 0,
              total: 1,
              message: `${file.name} · 이미지 확인 중`,
            });
            const asset = await readImage(file);
            if (controller.signal.aborted) break;
            const imageId = crypto.randomUUID();
            setJobs((prev) =>
              prev.map((j) =>
                j.id === id
                  ? {
                      ...j,
                      state: "ready",
                      imageId,
                      previews: [{ index: 0, asset }],
                    }
                  : j,
              ),
            );
            setRows((prev) => [
              ...prev,
              {
                id: imageId,
                name: file.name.replace(/\.[^.]+$/, "") || "붙여넣은 문제",
                filename: file.name,
                memo: "",
                asset,
              },
            ]);
          }
        } catch (e) {
          if (controller.signal.aborted) break;
          setJobs((prev) =>
            prev.map((j) =>
              j.id === id ? { ...j, state: "error", error: errorText(e) } : j,
            ),
          );
          setErrors((prev) => [
            ...prev,
            `${file.name}: ${e instanceof Error ? e.message : "파일을 읽지 못했습니다."}`,
          ]);
        }
      }
    } finally {
      if (controller.signal.aborted)
        setJobs((prev) =>
          prev.map((j) =>
            batch.some((b) => b.id === j.id) &&
            (j.state === "waiting" || j.state === "processing")
              ? { ...j, state: "cancelled", previews: [] }
              : j,
          ),
        );
      importing.current = false;
      setReading(0);
      setProgress(undefined);
    }
  }
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (busy) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input,textarea,[contenteditable="true"]')
      )
        return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        e.preventDefault();
        void ingest(files);
      }
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [busy]);
  async function save() {
    setBusy(true);
    try {
      await persist(rows);
      router.push("/questions");
    } catch (e) {
      setErrors((prev) => [...prev, errorText(e)]);
      setBusy(false);
    }
  }

  function removeDocument(id: string) {
    if (!confirm("이 파일을 등록 목록에서 제외할까요?")) return;
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    setJobs((prev) => prev.filter((j) => j.documentId !== id));
    if (reviewId === id) setReviewId(undefined);
  }
  function updateReview(
    pieces: ImportedDocument["pieces"],
    selectedIds: string[],
  ) {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === reviewId ? { ...doc, pieces, selectedIds } : doc,
      ),
    );
  }
  async function acceptReview(items: PendingQuestion[]) {
    await persist(items);
    setJobs((prev) =>
      prev.map((j) =>
        j.documentId === reviewId ? { ...j, state: "saved", previews: [] } : j,
      ),
    );
    const remaining = documentsRef.current.filter((doc) => doc.id !== reviewId);
    setDocuments(remaining);
    setReviewId(remaining[0]?.id);
    if (!remaining.length && !rows.length && !importing.current)
      router.push("/questions");
  }
  return { ...state, ingest, save, removeDocument, updateReview, acceptReview };
}

const Context = createContext<ReturnType<
  typeof useRegistrationController
> | null>(null);
export function RegistrationHandler({ children }: { children: ReactNode }) {
  const controller = useRegistrationController();
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useRegistrationHandler() {
  const context = useContext(Context);
  if (!context) throw new Error("RegistrationHandler is missing.");
  return context;
}
