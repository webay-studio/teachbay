import type { ImportedDocument, Piece, PendingQuestion } from "./types";
import type { StoredDocument, Question } from "../types";
import { composePiece } from "./compose";
import { reviewErrors } from "./review";
export async function prepareRegistration(
  doc: ImportedDocument,
  pieces: Piece[],
  signal: AbortSignal,
  onProgress: (message: string) => void,
): Promise<PendingQuestion[]> {
  const errors = reviewErrors(pieces);
  if (errors.length) throw new Error(errors.join(" "));
  const rows: PendingQuestion[] = [];
  for (let i = 0; i < pieces.length; i++) {
    onProgress(`${i + 1}/${pieces.length}개 · 이미지 만드는 중`);
    rows.push(await composePiece(doc, pieces[i], signal));
  }
  if (!doc.original)
    throw new Error("원본 파일을 찾을 수 없습니다. 다시 등록해주세요.");
  const now = new Date().toISOString();
  const record: StoredDocument = {
    id: doc.id,
    filename: doc.filename,
    blob: doc.original,
    sha256: doc.sha256 ?? "",
    version: 2,
    pages: doc.pages.map((p) => ({
      index: p.index,
      assetId: p.asset.id,
      sourceToAnalysis: p.sourceToAnalysis ?? [1, 0, 0, 0, 1, 0, 0, 0, 1],
    })),
    items: rows.map(
      (r) =>
        ({
          id: r.id,
          name: r.name,
          filename: r.filename,
          memo: r.memo,
          assetId: r.asset.id,
          source: r.source,
          fragments: r.fragments,
          materialIds: r.materialIds,
          dependencyIds: r.dependencyIds,
          sectionId: r.sectionId,
          originalLabel: r.originalLabel,
          createdAt: now,
          updatedAt: now,
        }) satisfies Question,
    ),
    relations: pieces.flatMap((p) => [
      ...(p.materialIds ?? []).map((to) => ({
        from: p.id,
        to,
        kind: "requires_material" as const,
        state: "confirmed" as const,
        evidence: "human" as const,
      })),
      ...(p.dependencyIds ?? []).map((to) => ({
        from: p.id,
        to,
        kind: "depends_on" as const,
        state: "confirmed" as const,
        evidence: "human" as const,
      })),
    ]),
  };
  // All source pages and reviewed materials survive library deletion.
  for (const row of rows) {
    row.fragments?.forEach((f, i) => {
      record.relations.push({
        from: f.id,
        to: row.id,
        kind: "belongs_to",
        state: "confirmed",
        evidence: "human",
      });
      if (i)
        record.relations.push({
          from: row.fragments![i - 1].id,
          to: f.id,
          kind: "continues",
          state: "confirmed",
          evidence: "human",
        });
    });
  }
  const allAssets = [
    ...rows.flatMap((r) => r.extraAssets ?? []),
    ...doc.pages.map((p) => p.asset),
    ...(doc.originalAssets ?? []),
  ];
  rows.forEach((r) => {
    r.document = record;
    r.extraAssets = allAssets;
  });

  return rows;
}
