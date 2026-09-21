import type { Matrix3, Point } from "./documents/registration-graph";
import type { ImageAsset } from "./pdf-region-engine/base-types";
export type { ImageAsset } from "./pdf-region-engine/base-types";
export type StoredFragment = {
  candidateRect?: { x: number; y: number; w: number; h: number };
  content?: import("./documents/content-bounds").ContentBounds;
  id: string;
  assetId: string;
  pageIndex: number;
  pageAssetId: string;
  rect: { x: number; y: number; w: number; h: number };
  polygon: Point[];
  sourceToAnalysis: Matrix3;
  analysisToSource: Matrix3;
};
export type StoredDocument = {
  id: string;
  filename: string;
  blob: Blob;
  sha256: string;
  version: 2;
  pages: { index: number; assetId: string; sourceToAnalysis: Matrix3 }[];
  items: Question[];
  relations: {
    from: string;
    to: string;
    kind: "requires_material" | "depends_on" | "continues" | "belongs_to";
    state: "confirmed";
    evidence: "human";
  }[];
};
export type Question = {
  fragments?: StoredFragment[];
  materialIds?: string[];
  dependencyIds?: string[];
  sectionId?: string;
  originalLabel?: string;

  source?: {
    kind: "question" | "passage" | "other";
    documentId: string;
    group?: string;
    pages: number[];
  };
  id: string;
  name: string;
  filename: string;
  memo: string;
  assetId: string;
  createdAt: string;
  updatedAt: string;
};
export type Settings = {
  columns: 1 | 2;
  space: "small" | "medium" | "large";
  numbers: boolean;
  nameLine: boolean;
  date: boolean;
  logoId?: string;
};
export type Snapshot = {
  id: string;
  name: string;
  assetId: string;
  fragments?: StoredFragment[];
  materials?: Snapshot[];
  dependencyIds?: string[];
  sectionId?: string;
  originalLabel?: string;
  kind?: "question" | "passage" | "other";
};
export type ExamDraft = {
  saved?: { signature: string; id: string; createdAt: string };
  id: "current";
  title: string;
  items: Snapshot[];
  settings: Settings;
};
export type Exam = {
  id: string;
  title: string;
  items: Snapshot[];
  settings: Settings;
  createdAt: string;
  pages: number;
};
export const defaults: Settings = {
  columns: 2,
  space: "medium",
  numbers: true,
  nameLine: true,
  date: false,
};
export const emptyDraft = (): ExamDraft => ({
  id: "current",
  title: "수학 단원 평가",
  items: [],
  settings: { ...defaults },
});
