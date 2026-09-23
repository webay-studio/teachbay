import { saveQuestions } from "@engine/db";
import { readImage } from "@engine/images";
import { importDocument } from "@engine/documents/import";
import type {
  ImportProgress,
  PendingQuestion,
  PagePreview,
} from "@engine/documents/types";
import { registrationRecords } from "./registrationHelpers.lib";
export { isDocument, DOCUMENT_ACCEPT } from "@engine/documents/import";
export { readImage };
export async function readDocument(
  file: File,
  onProgress: (progress: ImportProgress) => void,
  signal: AbortSignal,
  onPageRendered?: (page: PagePreview) => void,
) {
  return /\.pdf$/i.test(file.name) || file.type === "application/pdf"
    ? (await import("@engine/documents/pdf-registration")).importPdfQuestions(
        file,
        onProgress,
        signal,
        true,
        onPageRendered,
      )
    : importDocument(file, onProgress, signal, onPageRendered);
}
export async function persist(items: PendingQuestion[]) {
  await saveQuestions(registrationRecords(items, new Date().toISOString()));
}
