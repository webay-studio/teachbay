import { PSM } from "tesseract.js";
import type { DocumentPage, Piece, TextLine } from "./types";
import type { EditableFragment } from "./editable-preview";
import { editableNodes } from "./editable-preview";
import { fragmentErasures } from "./print-cleanup";
import { acquireOCR } from "../pdf-region-engine/ocr-worker";
import { abortable } from "../pdf-region-engine/cancel";
import { checkCancelled } from "../pdf-region-engine/browser-utils";

/** On-demand experiment only. No engine thresholds/passes or saved fragments are mutated. */
export async function extractEditablePreview(
  page: DocumentPage,
  piece: Piece,
  index: number,
  signal: AbortSignal,
  report: (message: string) => void,
): Promise<EditableFragment> {
  const rect = piece.fragments[index].rect;
  const url = URL.createObjectURL(page.asset.blob);
  const canvas = document.createElement("canvas");
  try {
    const image = new Image();
    image.src = url;
    await abortable(image.decode(), signal);
    checkCancelled(signal);
    canvas.width = Math.max(1, Math.round(rect.w * page.asset.width));
    canvas.height = Math.max(1, Math.round(rect.h * page.asset.height));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      image,
      rect.x * page.asset.width,
      rect.y * page.asset.height,
      rect.w * page.asset.width,
      rect.h * page.asset.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const masks = fragmentErasures(page, piece, index);
    for (const mask of masks)
      ctx.fillRect(
        ((mask.x - rect.x) / rect.w) * canvas.width,
        ((mask.y - rect.y) / rect.h) * canvas.height,
        (mask.w / rect.w) * canvas.width,
        (mask.h / rect.h) * canvas.height,
      );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("미리보기를 만들지 못했어요.")),
        "image/png",
      ),
    );
    checkCancelled(signal);
    const native =
      page.method === "text"
        ? editableNodes(
            (page.printTokens ?? []).filter(
              (t) => !t.group || t.group.startsWith("native-"),
            ),
            rect,
            masks,
          )
        : [];
    if (native.length)
      return {
        blob,
        width: canvas.width,
        height: canvas.height,
        nodes: native,
        source: "pdf",
      };
    report("선택한 영역에서 글자와 위치를 읽고 있어요.");
    const lease = await acquireOCR(signal);
    let failed = false;
    try {
      await abortable(
        lease.worker.setParameters({
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          tessedit_char_whitelist: "",
        }),
        signal,
      );
      const { data } = await abortable(
        lease.worker.recognize(canvas, {}, { blocks: true, text: true }),
        signal,
      );
      checkCancelled(signal);
      const tokens: TextLine[] = [];
      for (const block of data.blocks ?? [])
        for (const para of block.paragraphs)
          for (const line of para.lines)
            for (const word of line.words) {
              tokens.push({
                text: word.text,
                confidence: word.confidence,
                x: word.bbox.x0 / canvas.width,
                y: word.bbox.y0 / canvas.height,
                w: (word.bbox.x1 - word.bbox.x0) / canvas.width,
                h: (word.bbox.y1 - word.bbox.y0) / canvas.height,
              });
            }
      return {
        blob,
        width: canvas.width,
        height: canvas.height,
        nodes: editableNodes(tokens, { x: 0, y: 0, w: 1, h: 1 }),
        source: "ocr",
      };
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      await lease.release(failed || signal.aborted);
    }
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 1;
  }
}
