/** Public browser engine API. Import is safe during SSR; call analyzePdf in the browser. */
export { analyzePdf } from "./analyze-pdf";
export {
  selectDocumentContent,
  updateDocumentPart,
} from "./document-ownership";
export { ROLE_NAMES } from "./structure";
export type {
  PdfAnalysisOptions,
  PdfAnalysisPage,
  PdfAnalysisResult,
} from "./types";
export type {
  ImportProgress,
  ImageAsset,
  Rect,
  TextLine,
  Matrix3,
} from "./base-types";
export type { EvidenceLine, RegionGroup, StructureResult } from "./structure";
export type {
  QuestionRegion,
  QuestionPart,
  SharedSet,
  DocumentSection,
  FlowRegion,
  Observation,
} from "./question-regions";
export { serializeAnalysis } from "./serialize";
export type { SerializedPdfAnalysis } from "./serialize";
export { clusterPoints } from "./point-clusters";
