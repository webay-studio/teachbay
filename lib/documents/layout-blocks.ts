/** Compatibility path. Implementation lives in the PDF region engine. */
export * from "../pdf-region-engine/layout-blocks";
export {
  overlap,
  union,
  isMaterial,
  isOption,
  isFormula,
  buildBlocks,
} from "../pdf-region-engine/layout-blocks";
