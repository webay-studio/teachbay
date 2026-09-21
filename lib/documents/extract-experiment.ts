/** Compatibility entry point; new callers use lib/pdf-region-engine. */
export { analyzePdf as extractExperiment } from "../pdf-region-engine/analyze-pdf";
export type {
  PdfAnalysisPage as ExperimentPage,
  PdfAnalysisResult as PdfExperiment,
} from "../pdf-region-engine/types";
