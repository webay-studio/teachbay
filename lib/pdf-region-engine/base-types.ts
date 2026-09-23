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
  printTokens?: (TextLine & { group?: string })[];
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
  stage?:
    | "rendering"
    | "locating"
    | "ocr-page"
    | "ocr-detail"
    | "ocr-column"
    | "ocr-number-check"
    | "ocr-number-zoom"
    | "ocr-pagination"
    | "ocr-loading"
    | "ocr-reuse"
    | "shape-check"
    | "page-ready"
    | "assembling";
  message: string;
  current: number;
  total: number;
};
