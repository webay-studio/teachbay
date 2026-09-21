import type { ExamDraft } from "@engine/types";
export interface EditorState {
  value: ExamDraft | undefined;
  setValue: (
    value:
      | ExamDraft
      | undefined
      | ((previous: ExamDraft | undefined) => ExamDraft | undefined),
  ) => void;
  error: string;
  setError: (value: string | ((previous: string) => string)) => void;
  advanced: boolean;
  setAdvanced: (value: boolean | ((previous: boolean) => boolean)) => void;
  busy: boolean;
  setBusy: (value: boolean | ((previous: boolean) => boolean)) => void;
  status: string;
  setStatus: (value: string | ((previous: string) => string)) => void;
  drag: number | undefined;
  setDrag: (
    value:
      | number
      | undefined
      | ((previous: number | undefined) => number | undefined),
  ) => void;
}
