import type {
  PendingQuestion,
  ImportedDocument,
  ImportProgress,
} from "@engine/documents/types";
export interface RegistrationState {
  rows: PendingQuestion[];
  setRows: (
    value:
      PendingQuestion[] | ((previous: PendingQuestion[]) => PendingQuestion[]),
  ) => void;
  errors: string[];
  setErrors: (value: string[] | ((previous: string[]) => string[])) => void;
  busy: boolean;
  setBusy: (value: boolean | ((previous: boolean) => boolean)) => void;
  reading: number;
  setReading: (value: number | ((previous: number) => number)) => void;
  crop: string | undefined;
  setCrop: (
    value:
      | string
      | undefined
      | ((previous: string | undefined) => string | undefined),
  ) => void;
  documents: ImportedDocument[];
  setDocuments: (
    value:
      | ImportedDocument[]
      | ((previous: ImportedDocument[]) => ImportedDocument[]),
  ) => void;
  reviewId: string | undefined;
  setReviewId: (
    value:
      | string
      | undefined
      | ((previous: string | undefined) => string | undefined),
  ) => void;
  progress: ImportProgress | undefined;
  setProgress: (
    value:
      | ImportProgress
      | undefined
      | ((previous: ImportProgress | undefined) => ImportProgress | undefined),
  ) => void;
}
