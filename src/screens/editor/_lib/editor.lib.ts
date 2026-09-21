import { draft, put } from "@engine/db";
import type { ExamDraft } from "@engine/types";
import { readImage } from "@engine/images";
import { draftSignature } from "./editorHelpers.lib";
export { printExam } from "@engine/print";
export const loadDraft = () => draft();
export const saveDraft = (value: ExamDraft) => put("drafts", value);
export async function saveExam(value: ExamDraft, pages: number) {
  const signature = draftSignature(value);
  const id =
    value.saved?.signature === signature ? value.saved.id : crypto.randomUUID();
  const createdAt =
    value.saved?.signature === signature
      ? value.saved.createdAt
      : new Date().toISOString();
  await put("exams", {
    id,
    title: value.title.trim() || "제목 없는 시험지",
    items: structuredClone(value.items),
    settings: { ...value.settings },
    createdAt,
    pages,
  });
  const next = { ...value, saved: { signature, id, createdAt } };
  await put("drafts", next);

  return { next, id };
}
export async function saveLogo(file: File) {
  const asset = await readImage(file);
  await put("assets", asset);
  return asset.id;
}
