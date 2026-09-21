import type { PdfAnalysisResult } from "./types";
/** JSON metadata only. Original PDF and image Blobs remain owned by the caller. */
export function serializeAnalysis(result: PdfAnalysisResult) {
  return {
    ...result,
    pages: result.pages.map((p) => ({
      index: p.index,
      width: p.asset.width,
      height: p.asset.height,
      sourceToAnalysis: p.sourceToAnalysis,
      method: p.method,
      warnings: p.warnings,
      preprocessing: p.preprocessing,
      nativeLines: p.nativeLines,
      inkRegions: p.inkRegions,
      shapeReport: p.shapeReport,
      beforeShapeLines: p.beforeShapeLines,
      observations: p.observations,
      visualRegions: p.visualRegions,
      containers: p.containers,
      horizontalRules: p.horizontalRules,
      sourceKind: p.sourceKind,
      timings: p.timings,
      coordinateFrames: p.coordinateFrames,
      inkPoints: p.inkPoints,
    })),
    hasHandwriting: null, // No handwriting classifier: do not fabricate a boolean.
    regions: result.groups.map((g) => ({
      questionId: g.questionId ?? g.id,
      questionNumber: g.questionNumber ?? null,
      originalNumber: g.originalNumber ?? "",
      section: g.section ?? "",
      kind: g.kind,
      pageIndex: g.page,
      partIndex: g.partIndex ?? 1,
      hasVisual: g.visualCandidate ? true : null,
      xStart: g.rect.x,
      xEnd: g.rect.x + g.rect.w,
      yStart: g.rect.y,
      yEnd: g.rect.y + g.rect.h,
      issues: g.warnings,
    })),
    coordinates: "normalized 0..1, top-left of rendered page",
  };
}
export type SerializedPdfAnalysis = ReturnType<typeof serializeAnalysis>;
