import { autoBundlePassages } from "./passage-bundles";
import {
  analyzePdf,
  type PdfAnalysisResult,
  type QuestionPart,
} from "../pdf-region-engine";
import type {
  ImportedDocument,
  ImportProgress,
  Piece,
  PagePreview,
} from "./types";

/** Adapt engine ownership without re-segmenting or merging physical fragments. */
export function analysisToDocument(
  result: PdfAnalysisResult,
  original: File,
): ImportedDocument {
  const pages = result.pages.map((p) => ({
    ...p,
    printTokens: p.observations
      .filter(
        (o) =>
          o.state === "supported" &&
          o.geometryStatus !== "uncertain" &&
          o.textStatus !== "encoding-suspect",
      )
      .map((o) => ({
        ...o.rect,
        text: o.text,
        confidence: o.confidence ?? 100,
        group: o.passId,
      })),
    asset: p.analysisAsset ?? p.asset,
  }));
  const fragments = (parts: QuestionPart[]) =>
    parts.map((part) => {
      const page = pages[part.pageIndex];
      if (!page)
        throw new Error("문항에 필요한 원본 페이지를 찾을 수 없습니다.");
      return {
        pageId: page.id,
        numberOnly: part.role === "number-only",
        rect: {
          x: part.bbox.x,
          y: part.bbox.y,
          w: part.bbox.width,
          h: part.bbox.height,
        },
      };
    });
  const section = (id: string) =>
    result.sections?.find((s) => s.id === id)?.label;
  const pieces: Piece[] = [
    ...(result.sharedSets ?? []).map((s) => ({
      id: s.id,
      kind: "passage" as const,
      name: `${section(s.sectionId) ?? ""} 공통 지문 ${s.sourceRange.join("–")}`.trim(),
      sectionId: s.sectionId,
      fragments: fragments(s.parts),
      warnings: s.issues,
      confirmed: false,
    })),
    ...(result.questions ?? []).map((q) => ({
      id: q.id,
      kind: "question" as const,
      name: `${section(q.sectionId) ?? ""} ${q.sourceNumber ?? q.sourceLabel ?? "번호 확인"}번`.trim(),
      number: q.sourceNumber ?? undefined,
      originalLabel: q.sourceLabel ?? undefined,
      sectionId: q.sectionId,
      materialIds: [...q.sharedMaterialIds],
      fragments: fragments(q.parts),
      warnings: q.issues,
      confirmed: false,
    })),
  ];
  const owners = [...(result.sharedSets ?? []), ...(result.questions ?? [])];
  const flowOrder = new Map(
    owners.map((o) => [
      o.id,
      result.flowRegions?.find((f) => f.id === o.parts[0]?.flowRegionId)
        ?.order ?? 0,
    ]),
  );
  pieces.sort((a, b) => {
    const af = a.fragments[0],
      bf = b.fragments[0];
    const ai = pages.findIndex((p) => p.id === af?.pageId),
      bi = pages.findIndex((p) => p.id === bf?.pageId);
    return (
      ai - bi ||
      (flowOrder.get(a.id) ?? 0) - (flowOrder.get(b.id) ?? 0) ||
      (af?.rect.y ?? 0) - (bf?.rect.y ?? 0)
    );
  });
  return {
    id: crypto.randomUUID(),
    filename: original.name,
    original,
    pages,
    pieces: autoBundlePassages(pieces),
    engine: "pdf-regions",
    originalAssets: result.pages.map((p) => p.asset),
    warnings: [
      "자동 분리 결과를 원본과 비교하고 필요한 문제를 선택해주세요.",
      ...(result.pages.some((p) => p.preprocessing.enabled)
        ? [
            "색상 전처리 이미지를 표시하고 저장합니다. 인쇄 색상도 달라질 수 있으며 원본 PDF는 함께 보관합니다.",
          ]
        : []),
    ],
  };
}
export async function importPdfQuestions(
  file: File,
  onProgress: (p: ImportProgress) => void,
  signal: AbortSignal,
  removeInk = true,
  onPageRendered?: (page: PagePreview) => void,
) {
  const result = await analyzePdf(file, signal, onProgress, {
    removeInk,
    shapeFilter: true,
    distributionOnly: false,
    ocrPolicy: "legacy",
    connectivity: 4,
    maxPages: 40,
    onPageRendered,
  });
  const doc = analysisToDocument(result, file);
  doc.sha256 = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (signal.aborted)
    throw new DOMException("가져오기를 취소했습니다.", "AbortError");
  return doc;
}
