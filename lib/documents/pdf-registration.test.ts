import test from "node:test";
import assert from "node:assert/strict";
import { analysisToDocument } from "./pdf-registration";
import { selectedPiecesForRegistration, reviewErrors } from "./review";
import { mergePieces } from "./segment";
import type {
  PdfAnalysisPage,
  PdfAnalysisResult,
  QuestionPart,
} from "../pdf-region-engine";
function fixture(): PdfAnalysisResult {
  const pages: PdfAnalysisPage[] = Array.from({ length: 2 }, (_, index) => ({
    id: `page-${index}`,
    index,
    asset: {
      id: `original-${index}`,
      blob: new Blob(["original"]),
      mime: "image/png",
      width: 1000,
      height: 1400,
    },
    analysisAsset: {
      id: `processed-${index}`,
      blob: new Blob(["processed"]),
      mime: "image/png",
      width: 1000,
      height: 1400,
    },
    lines: [],
    method: "text",
    warnings: [],
    observations: [],
    visualRegions: [],
    sourceKind: "native",
    timings: {
      renderMs: 0,
      nativeMs: 0,
      ocrMs: 0,
      shapeMs: 0,
      totalMs: 0,
      ocrPasses: 0,
    },
    coordinateFrames: {
      rotation: 0,
      cropBox: [0, 0, 1000, 1400],
      viewportToCanvas: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      componentScale: 1,
      ocrCrops: [],
    },
    preprocessing: {
      enabled: true,
      annotationCount: 0,
      nativeLinesExcluded: 0,
    },
    nativeLines: [],
    inkRegions: [],
    inkPoints: [],
  }));
  const part = (id: string, pageIndex: number, y: number): QuestionPart => ({
    id,
    pageIndex,
    flowRegionId: `flow-${pageIndex}`,
    bbox: { x: 0.1, y, width: 0.35, height: 0.15 },
    role: "whole",
    sourceBlockIds: [],
  });
  return {
    filename: "sample.pdf",
    version: "text-structure-v3",
    workerLoadMs: 0,
    ocrPolicy: "legacy",
    distributionOnly: false,
    description: "test",
    lines: [],
    groups: [],
    relations: [],
    pages,
    sections: [
      { id: "section", label: "공통", kind: "common", pageIndices: [0, 1] },
    ],
    flowRegions: [0, 1].map((pageIndex) => ({
      id: `flow-${pageIndex}`,
      pageIndex,
      order: 0,
      rect: { x: 0, y: 0, w: 0.5, h: 1 },
      kind: "column",
    })),
    sharedSets: [
      {
        id: "material",
        sectionId: "section",
        sourceRange: [1, 2],
        questionIds: ["q1", "q2"],
        parts: [part("s1", 0, 0.1), part("s2", 1, 0.1)],
        status: "needs-review",
        issues: [],
      },
    ],
    questions: [
      {
        id: "q1",
        sectionId: "section",
        sourceNumber: 1,
        sourceLabel: "1.",
        parts: [part("q1a", 0, 0.5), part("q1b", 1, 0.4)],
        sharedMaterialIds: ["material"],
        status: "needs-review",
        issues: [],
      },
      {
        id: "q2",
        sectionId: "section",
        sourceNumber: 2,
        sourceLabel: "2.",
        parts: [part("q2a", 1, 0.7)],
        sharedMaterialIds: ["material"],
        status: "needs-review",
        issues: [],
      },
    ],
  };
}
test("registration preserves engine fragment coordinates/order, shared identity and original assets", () => {
  const result = fixture(),
    file = new File(["pdf"], "sample.pdf", { type: "application/pdf" }),
    doc = analysisToDocument(result, file);
  assert.equal(doc.engine, "pdf-regions");
  assert.equal(doc.original, file);
  assert.equal(doc.originalAssets?.[0].id, "original-0");
  assert.equal(doc.pages[0].asset.id, "processed-0");
  assert.deepEqual(
    doc.pieces.map((p) => p.id),
    ["material", "q1", "q2"],
  );
  const q = doc.pieces.find((p) => p.id === "q1")!;
  assert.equal(q.confirmed, false);
  assert.deepEqual(q.materialIds, ["material"]);
  assert.deepEqual(
    q.fragments.map((f) => f.pageId),
    ["page-0", "page-1"],
  );
  assert.deepEqual(q.fragments[1].rect, { x: 0.1, y: 0.4, w: 0.35, h: 0.15 });
});
test("selection includes required shared material once without selecting sibling questions", () => {
  const doc = analysisToDocument(fixture(), new File(["x"], "sample.pdf"));
  assert.deepEqual(
    selectedPiecesForRegistration(doc.pieces, ["q1"]).map((p) => p.id),
    ["material", "q1"],
  );
  assert.deepEqual(
    selectedPiecesForRegistration(doc.pieces, ["q1", "q2"]).map((p) => p.id),
    ["material", "q1", "q2"],
  );
  assert.deepEqual(selectedPiecesForRegistration(doc.pieces, []), []);
  assert.ok(
    reviewErrors(selectedPiecesForRegistration(doc.pieces, ["q1"])).length > 0,
  );
  assert.deepEqual(
    reviewErrors(
      selectedPiecesForRegistration(doc.pieces, ["q1"]).map((p) => ({
        ...p,
        confirmed: true,
      })),
    ),
    [],
  );
});
test("merging materials updates referencing questions instead of dropping dependencies", () => {
  const doc = analysisToDocument(fixture(), new File(["x"], "sample.pdf"));
  const material = doc.pieces[0];
  doc.pieces.push({ ...material, id: "material2" });
  doc.pieces[1].materialIds = ["material", "material2"];
  const merged = mergePieces(doc.pieces, ["material", "material2"]);
  assert.deepEqual(merged.find((p) => p.id === "q1")?.materialIds, [
    "material",
  ]);
  assert.equal(merged.find((p) => p.id === "material")?.fragments.length, 4);
});
