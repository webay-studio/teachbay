/** Headless geometry/ownership API: consumes captured observations, performs no OCR or rendering. */
export { buildStructure } from "./structure";
export { combineRegions } from "./hybrid-regions";
export {
  assignDocumentOwnership,
  selectDocumentContent,
  updateDocumentPart,
} from "./document-ownership";
export { physicalRegions } from "./physical";
export type { PdfAnalysisPage, PdfAnalysisResult } from "./types";
export type { EvidenceLine, StructureResult } from "./structure";
