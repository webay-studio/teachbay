import type { ImageAsset, StoredFragment, StoredDocument } from "../types";
import type { Rect, DocumentPage } from "../pdf-region-engine/base-types";
export type {
  Rect,
  TextLine,
  DocumentPage,
  ImportProgress,
} from "../pdf-region-engine/base-types";
export type Fragment = {
  pageId: string;
  rect: Rect;
  candidateRect?: Rect;
  content?: import("./content-bounds").ContentBounds;
};
export type Piece = {
  materialIds?: string[];
  dependencyIds?: string[];
  sectionId?: string;
  originalLabel?: string;
  continuationOf?: string;
  confirmed?: boolean;
  id: string;
  name: string;
  kind: "question" | "passage" | "other";
  number?: number;
  group?: string;
  fragments: Fragment[];
  warnings: string[];
};
export type ImportedDocument = {
  selectedIds?: string[];
  engine?: "pdf-regions";
  originalAssets?: ImageAsset[];
  original?: Blob;
  sha256?: string;
  id: string;
  filename: string;
  pages: DocumentPage[];
  pieces: Piece[];
  warnings: string[];
};
export type ColumnMode = "auto" | "1" | "2";

export type PendingQuestion = {
  fragments?: StoredFragment[];
  extraAssets?: ImageAsset[];
  materialIds?: string[];
  dependencyIds?: string[];
  sectionId?: string;
  originalLabel?: string;
  document?: StoredDocument;
  id: string;
  name: string;
  filename: string;
  memo: string;
  asset: ImageAsset;
  source?: {
    kind: Piece["kind"];
    documentId: string;
    group?: string;
    pages: number[];
  };
};
