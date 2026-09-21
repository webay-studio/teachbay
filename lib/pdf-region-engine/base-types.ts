export type ImageAsset = {
  id: string;
  blob: Blob;
  mime: string;
  width: number;
  height: number;
};
export type Matrix3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
  pixelCount?: number;
};
export type TextLine = Rect & { text: string; confidence?: number };
export type DocumentPage = {
  diagnostics?: string[];
  ocrPasses?: { region: Rect; mode: string; lines: TextLine[] }[];
  sourceToAnalysis?: Matrix3;
  regions?: Rect[];
  role?: "cover" | "content" | "unknown";
  id: string;
  index: number;
  asset: ImageAsset;
  lines: TextLine[];
  method: "text" | "ocr" | "unread";
  warnings: string[];
};
export type ImportProgress = {
  message: string;
  current: number;
  total: number;
};
