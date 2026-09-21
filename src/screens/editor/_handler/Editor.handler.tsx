"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ExamDraft, Settings } from "@engine/types";
import { errorText } from "@engine/db";
import { useEditorState } from "../_state/useEditorStore";
import {
  loadDraft,
  saveDraft,
  saveExam,
  saveLogo,
  printExam,
} from "../_lib/editor.lib";
import { moveDraftItem } from "../_lib/editorHelpers.lib";
function useEditorController() {
  const state = useEditorState();
  const { value, setValue, busy, setBusy, setError, setStatus, queue } = state;
  const router = useRouter();
  const saving = useRef(false);
  useEffect(() => {
    loadDraft()
      .then(setValue)
      .catch((e) => setError(errorText(e)));
  }, [setValue, setError]);
  function update(next: ExamDraft) {
    if (busy) return;
    setValue(next);
    setStatus("저장 중…");
    queue.current = queue.current
      .catch(() => {})
      .then(() => saveDraft(next))
      .then(() => setStatus("작성 중인 내용 자동 저장됨"))
      .catch((e) => {
        setError(errorText(e));
        throw e;
      });
    queue.current.catch(() => {});
  }

  async function save(pages: number, printing: boolean) {
    if (!value || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await queue.current;
      const { next, id } = await saveExam(value, pages);
      setValue(next);
      if (printing) {
        await printExam();
        setStatus("시험지를 저장하고 출력 창을 요청했습니다.");
      } else router.push(`/exams/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorText(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return { ...state, update, save };
}
type Controls = {
  value: ExamDraft;
  update: (value: ExamDraft) => void;
  setBusy: (value: boolean) => void;
  setError: (value: string) => void;
};
export function createEditorControls({
  value,
  update,
  setBusy,
  setError,
}: Controls) {
  function setting<K extends keyof Settings>(
    key: K,
    settingValue: Settings[K],
  ) {
    update({ ...value, settings: { ...value.settings, [key]: settingValue } });
  }
  function move(from: number, to: number) {
    update(moveDraftItem(value, from, to));
  }
  async function uploadLogo(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      setting("logoId", await saveLogo(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return { setting, move, uploadLogo };
}
import { useLayout } from "@ui/exam-renderer";
type EditorContext = ReturnType<typeof useEditorController> & {
  value: ExamDraft;
  assets: ReturnType<typeof useLayout>["assets"];
  pages: ReturnType<typeof useLayout>["pages"];
  loading: boolean;
  layoutError: string;
} & ReturnType<typeof createEditorControls>;
const Context = createContext<EditorContext | null>(null);
function EditorReadyHandler({
  controller,
  children,
}: {
  controller: ReturnType<typeof useEditorController> & { value: ExamDraft };
  children: ReactNode;
}) {
  const {
    assets,
    pages,
    loading,
    error: layoutError,
  } = useLayout(controller.value.items, controller.value.settings);
  const controls = createEditorControls(controller);
  return (
    <Context.Provider
      value={{
        ...controller,
        ...controls,
        assets,
        pages,
        loading,
        layoutError,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function EditorHandler({ children }: { children: ReactNode }) {
  const controller = useEditorController();
  if (!controller.value)
    return (
      <div className="empty">
        {controller.error || "작성 중인 시험지를 불러오는 중…"}
      </div>
    );
  return (
    <EditorReadyHandler controller={{ ...controller, value: controller.value }}>
      {children}
    </EditorReadyHandler>
  );
}
export function useEditorHandler() {
  const context = useContext(Context);
  if (!context) throw new Error("EditorHandler is missing.");
  return context;
}
