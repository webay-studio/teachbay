import { createWorker, OEM } from "tesseract.js";
import { abortable } from "./cancel";
type Worker = Awaited<ReturnType<typeof createWorker>>;
let cached: Worker | undefined,
  busy = false;
/** A single reusable worker per browser module. Never starts an unbounded pool. */
export async function acquireOCR(signal: AbortSignal) {
  if (busy) throw new Error("다른 OCR 작업이 진행 중입니다.");
  busy = true;
  const started = performance.now();
  const cold = !cached;
  try {
    if (!cached) {
      const runtime = "/document-runtime/ocr";
      const pending = createWorker(["kor", "eng"], OEM.LSTM_ONLY, {
        workerPath: `${runtime}/worker.min.js`,
        corePath: runtime,
        langPath: `${runtime}/lang`,
      });
      pending
        .then((w) => {
          if (signal.aborted) void w.terminate();
        })
        .catch(() => {});
      cached = await abortable(pending, signal);
    }
    const worker = cached;
    let released = false;
    return {
      worker,
      loadMs: cold ? performance.now() - started : 0,
      release: async (discard = false) => {
        if (released) return;
        released = true;
        if (discard) {
          cached = undefined;
          await worker.terminate().catch(() => {});
        }
        busy = false;
      },
    };
  } catch (error) {
    busy = false;
    throw error;
  }
}
