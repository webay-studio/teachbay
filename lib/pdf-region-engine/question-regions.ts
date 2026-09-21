import type { Rect } from "./base-types";
import type { Matrix3 } from "./base-types";
export type QuestionPart = {
  id: string;
  pageIndex: number;
  flowRegionId: string;
  bbox: { x: number; y: number; width: number; height: number };
  role: "whole" | "start" | "continuation" | "number-only";
  sourceBlockIds: string[];
};
export type QuestionRegion = {
  id: string;
  sectionId: string;
  sourceLabel: string | null;
  sourceNumber: number | null;
  displayNumber?: number;
  auxiliaryParts?: QuestionPart[];
  parts: QuestionPart[];
  sharedMaterialIds: string[];
  status: "complete" | "needs-review";
  issues: string[];
};
export type FlowRegion = {
  id: string;
  pageIndex: number;
  order: number;
  rect: Rect;
  kind: "column" | "spanning";
};
export type Observation = {
  id: string;
  source: "pdf" | "ocr";
  passId: string;
  pageIndex: number;
  flowRegionId: string;
  transform: Matrix3;
  confidence: number | null;
  rect: Rect;
  text: string;
  fontName?: string;
  fontFamily?: string;
  geometryStatus?: "usable" | "uncertain";
  textStatus?: "usable" | "encoding-suspect" | "uncertain";
  state: "supported" | "held";
  issues: string[];
  inkSupport: number;
  removedInkRatio: number;
};
export type ContentBlock = {
  id: string;
  pageIndex: number;
  flowRegionId: string;
  rect: Rect;
  role: "text" | "formula" | "visual" | "option" | "material" | "unknown";
  lineIds: string[];
  componentIds: number[];
  text: string;
  classification: "protected-print" | "suspected-handwriting" | "unknown";
};
export const boxOf = (r: Rect): QuestionPart["bbox"] => ({
  x: r.x,
  y: r.y,
  width: r.w,
  height: r.h,
});
export const rectOf = (b: QuestionPart["bbox"]): Rect => ({
  x: b.x,
  y: b.y,
  w: b.width,
  h: b.height,
});

export type DocumentSection = {
  id: string;
  label: string;
  kind: "common" | "option" | "unknown";
  pageIndices: number[];
};
export type SharedSet = {
  id: string;
  sectionId: string;
  sourceRange: [number, number];
  parts: QuestionPart[];
  questionIds: string[];
  issues: string[];
  status: "needs-review";
};
export type SourceContainer = {
  id: string;
  rect: Rect;
  tiles: Rect[];
  kind: "raster" | "vector";
  ownerId?: string;
};
