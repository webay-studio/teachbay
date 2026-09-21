import { PSM, type Worker } from "tesseract.js";
import type { Rect, TextLine } from "./types";
import { marker } from "./segment";
export async function recognizeRegions(
  worker: Worker,
  regions: Rect[],
  width: number,
  height: number,
  imageFor: (r: Rect) => Promise<Parameters<Worker["recognize"]>[0]>,
  signal?: AbortSignal,
  onDiagnostic?: (message: string) => void,
  onPass?: (pass: { region: Rect; mode: string; lines: TextLine[] }) => void,
): Promise<TextLine[]> {
  const lines: TextLine[] = [];
  for (const r of regions.length ? regions : [{ x: 0, y: 0, w: 1, h: 1 }]) {
    if (signal?.aborted)
      throw new DOMException("취소되었습니다.", "AbortError");
    const image = await imageFor(r);
    // Two bounded passes: page structure, then sparse printed start markers.
    for (const mode of [PSM.AUTO, PSM.SPARSE_TEXT]) {
      await worker.setParameters({ tessedit_pageseg_mode: mode });
      const { data } = await worker.recognize(
        image,
        {},
        { blocks: true, text: true, debug: true },
      );
      if (data.debug) onDiagnostic?.(data.debug.slice(0, 5000));
      const rawLines: TextLine[] = [];
      for (const block of data.blocks ?? [])
        for (const para of block.paragraphs)
          for (const l of para.lines) {
            const line = {
              text: l.text,
              x: r.x + l.bbox.x0 / width,
              y: r.y + l.bbox.y0 / height,
              w: (l.bbox.x1 - l.bbox.x0) / width,
              h: (l.bbox.y1 - l.bbox.y0) / height,
              confidence: l.confidence,
            };
            rawLines.push(line);
            if (mode === PSM.SPARSE_TEXT) {
              if (!marker(line.text)) continue;
              const at = lines.findIndex(
                (old) =>
                  Math.abs(old.y - line.y) < Math.max(old.h, line.h) * 0.5 &&
                  Math.abs(old.x - line.x) < 0.035,
              );
              if (at >= 0) {
                if (
                  !marker(lines[at].text) ||
                  (line.confidence ?? 0) > (lines[at].confidence ?? 0)
                )
                  lines[at] = line;
                continue;
              }
            }
            lines.push(line);
          }
      onPass?.({ region: r, mode, lines: rawLines });
    }
  }
  return lines;
}
