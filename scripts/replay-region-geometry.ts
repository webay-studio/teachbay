import { assignDocumentOwnership } from "../lib/pdf-region-engine/core";
/** Reuse identical OCR observations to isolate grouping/shape-classification changes. */
import fs from "node:fs/promises";
import { combineRegions } from "../lib/pdf-region-engine/core";
import type {
  PdfAnalysisResult,
  PdfAnalysisPage,
} from "../lib/pdf-region-engine";
async function main() {
  const [input, output, mode = "shape"] = process.argv.slice(2);
  const d = JSON.parse(await fs.readFile(input, "utf8")) as Omit<
    PdfAnalysisResult,
    "pages"
  > & {
    pages: (PdfAnalysisResult["pages"][number] & {
      width: number;
      height: number;
    })[];
  };
  const pages = d.pages.map((p) => ({
    ...p,
    asset: {
      id: "replay",
      blob: new Blob(),
      mime: "image/png",
      width: p.width,
      height: p.height,
    },
    regions: d.flowRegions
      ?.filter((f) => f.pageIndex === p.index)
      .map((f) => f.rect),
    shapeReport: mode === "no-shape" ? undefined : p.shapeReport,
  })) as PdfAnalysisPage[];
  const r = assignDocumentOwnership(combineRegions(d, pages), pages);
  await fs.writeFile(
    output,
    JSON.stringify(
      { ...d, ...r, replay: { input, mode, ocrReexecuted: false } },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      output,
      questions: r.questions?.map((q) => [
        q.sectionId,
        q.sourceNumber,
        q.parts.length,
      ]),
    }),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
