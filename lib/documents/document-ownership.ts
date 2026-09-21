/** Compatibility path. Implementation lives in the PDF region engine. */
export * from "../pdf-region-engine/document-ownership";
export {
  readSharedRange,
  assignDocumentOwnership,
  selectDocumentContent,
  updateDocumentPart,
} from "../pdf-region-engine/document-ownership";
