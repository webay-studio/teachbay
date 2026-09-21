import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  analyzePdf,
  serializeAnalysis,
  type PdfAnalysisResult,
} from "../pdf-region-engine";
import { extractExperiment } from "./extract-experiment";
import { ocrResults } from "../pdf-region-engine/ocr-result-cache";
import { labOCRResults } from "./ocr-result-cache";
import { canvasAsset } from "./import";
import { canvasAsset as engineCanvasAsset } from "../pdf-region-engine/browser-utils";

test("engine import needs no DOM; legacy entry points share implementation and cache", () => {
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(analyzePdf, extractExperiment);
  assert.equal(ocrResults, labOCRResults);
  assert.equal(canvasAsset, engineCanvasAsset);
});

test("engine implementation has no application, storage or legacy importer dependencies", () => {
  const root = new URL("../pdf-region-engine/", import.meta.url);
  for (const file of fs.readdirSync(root).filter((f) => f.endsWith(".ts"))) {
    const source = fs.readFileSync(new URL(file, root), "utf8");
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*["']\.\.\//, file);
    assert.doesNotMatch(
      source,
      /(?:from\s*|import\s*\()\s*["'](?:react|next|@rhwp\/core)(?:["'/])/,
      file,
    );
  }
});

test("JSON export preserves part coordinates, unknown classifications and excludes image blobs", () => {
  const result = {
    lines: [],
    relations: [],
    pages: [
      {
        id: "page",
        index: 0,
        asset: {
          id: "asset",
          blob: new Blob(["original"]),
          mime: "image/png",
          width: 100,
          height: 200,
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
          cropBox: [0, 0, 100, 200],
          viewportToCanvas: [1, 0, 0, 0, 1, 0, 0, 0, 1],
          componentScale: 1,
          ocrCrops: [],
        },
        preprocessing: {
          enabled: false,
          annotationCount: 0,
          nativeLinesExcluded: 0,
        },
        nativeLines: [],
        inkRegions: [],
        inkPoints: [],
      },
    ],
    distributionOnly: false,
    filename: "sample.pdf",
    version: "text-structure-v3",
    workerLoadMs: 0,
    ocrPolicy: "legacy",
    description: "sample",
    groups: [
      {
        id: "part",
        page: 2,
        kind: "question",
        label: "1",
        lineIds: [],
        rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
        reasons: [],
        warnings: [],
        status: "candidate",
        questionId: "q",
        questionNumber: 1,
        partIndex: 2,
      },
    ],
  } satisfies PdfAnalysisResult;
  const exported = serializeAnalysis(result);
  assert.equal(exported.pages[0].width, 100);
  assert.equal(exported.pages[0].height, 200);
  assert.equal("asset" in exported.pages[0], false);
  assert.equal(JSON.stringify(exported).includes('"blob"'), false);
  assert.equal(exported.hasHandwriting, null);
  assert.equal(exported.regions[0].hasVisual, null);
  assert.equal(exported.regions[0].partIndex, 2);
  assert.equal(exported.regions[0].pageIndex, 2);
  assert.equal(exported.regions[0].xEnd, 0.1 + 0.3);
  assert.equal(exported.regions[0].yEnd, 0.2 + 0.4);
  assert.equal(
    exported.coordinates,
    "normalized 0..1, top-left of rendered page",
  );
});
