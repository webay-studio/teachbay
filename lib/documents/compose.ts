import type { ImportedDocument, PendingQuestion, Piece } from "./types";
import { canvasAsset, imageFromBlob, checkCancelled } from "./import";
import {
  invert,
  transform,
  type Matrix3,
  type Point,
} from "./registration-graph";
/** Store each original region independently. Never trim answer space or stitch pages. */
export async function composePiece(
  doc: ImportedDocument,
  piece: Piece,
  signal: AbortSignal,
): Promise<PendingQuestion> {
  const extraAssets: NonNullable<PendingQuestion["extraAssets"]> = [],
    fragments: NonNullable<PendingQuestion["fragments"]> = [];
  for (const f of piece.fragments) {
    checkCancelled(signal);
    const page = doc.pages.find((p) => p.id === f.pageId);
    if (!page) throw new Error("원본 페이지를 찾을 수 없습니다.");
    const r = f.rect;
    if (
      r.w <= 0 ||
      r.h <= 0 ||
      r.x < 0 ||
      r.y < 0 ||
      r.x + r.w > 1.001 ||
      r.y + r.h > 1.001
    )
      throw new Error("영역이 원본 페이지를 벗어났습니다.");
    const image = await imageFromBlob(page.asset.blob),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(r.w * page.asset.width));
    canvas.height = Math.max(1, Math.round(r.h * page.asset.height));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      r.x * page.asset.width,
      r.y * page.asset.height,
      r.w * page.asset.width,
      r.h * page.asset.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const asset = await canvasAsset(canvas);
    extraAssets.push(asset, page.asset);
    canvas.width = canvas.height = 1;
    const m: Matrix3 = page.sourceToAnalysis ?? [1, 0, 0, 0, 1, 0, 0, 0, 1],
      inv = invert(m);
    const x = r.x * page.asset.width,
      y = r.y * page.asset.height,
      w = r.w * page.asset.width,
      h = r.h * page.asset.height;
    fragments.push({
      id: crypto.randomUUID(),
      assetId: asset.id,
      pageAssetId: page.asset.id,
      pageIndex: page.index,
      rect: r,
      candidateRect: f.candidateRect,
      content: f.content,
      polygon: (
        [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ] as Point[]
      ).map((p) => transform(inv, p)),
      sourceToAnalysis: m,
      analysisToSource: inv,
    });
  }
  if (!fragments.length) throw new Error("저장할 원본 영역이 없습니다.");
  return {
    id: piece.id,
    name: piece.name,
    filename: doc.filename,
    memo: `${doc.filename} · 원본 조각 ${fragments.length}개`,
    asset: extraAssets[0],
    extraAssets,
    fragments,
    materialIds: piece.materialIds ?? [],
    dependencyIds: piece.dependencyIds ?? [],
    sectionId: piece.sectionId,
    originalLabel: piece.originalLabel ?? piece.number?.toString(),
    source: {
      kind: piece.kind,
      documentId: doc.id,
      group: piece.group ? `${doc.id}:${piece.group}` : undefined,
      pages: [...new Set(fragments.map((f) => f.pageIndex + 1))],
    },
  };
}
