import type {
  DocumentPage,
  ImageAsset,
  Rect,
  TextLine,
  Matrix3,
} from "./base-types";
import type { Observation } from "./question-regions";
import type { InkStats } from "./ink-preprocess";
import type { ShapeInkReport } from "./shape-ink-filter";
import type { EvidenceLine, StructureResult } from "./structure";
import type { HybridDiagnostics } from "./hybrid-regions";
export type PdfAnalysisPage = DocumentPage & {
  analysisAsset?: ImageAsset;
  colorAsset?: ImageAsset;
  shapeMaskAsset?: ImageAsset;
  shapeReport?: ShapeInkReport;
  beforeShapeLines?: EvidenceLine[];
  observations: Observation[];
  visualRegions: Rect[];
  containers?: import("./question-regions").SourceContainer[];
  horizontalRules?: Rect[];
  sourceKind: "native" | "scan" | "mixed";
  timings: {
    renderMs: number;
    nativeMs: number;
    ocrMs: number;
    shapeMs: number;
    totalMs: number;
    ocrPasses: number;
    ocrRecognitions?: number;
    ocrCacheHits?: number;
    ocrCacheMs?: number;
  };
  coordinateFrames: {
    rotation: number;
    cropBox: number[];
    viewportToCanvas: Matrix3;
    componentScale: number;
    ocrCrops: { passId: string; rect: Rect; toCanvas: Matrix3 }[];
  };
  preprocessing: {
    enabled: boolean;
    annotationCount: number;
    stats?: InkStats;
    nativeLinesExcluded: number;
  };
  nativeLines: TextLine[];
  inkRegions: Rect[];
  inkPoints: Rect[];
};
export type PdfAnalysisResult = StructureResult & {
  distributionOnly: boolean;
  hybrid?: HybridDiagnostics[];
  filename: string;
  pages: PdfAnalysisPage[];
  version: "text-structure-v3";
  description: string;
  workerLoadMs: number;
  ocrPolicy: "adaptive" | "legacy";
};
export type PdfAnalysisOptions = {
  maxPages?: number;
  removeInk: boolean;
  distributionOnly?: boolean;
  shapeFilter?: boolean;
  ocrPolicy?: "adaptive" | "legacy";
  connectivity?: 4 | 8;
};
