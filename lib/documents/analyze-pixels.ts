import type { Rect } from "./types";
/** Keep projection/colour analysis off the UI thread. */
export async function analyzePixels(
  pixels: ImageData,
  signal: AbortSignal,
): Promise<{ regions: Rect[]; neutral: Uint8ClampedArray }> {
  if (signal.aborted) throw new DOMException("취소되었습니다.", "AbortError");
  const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url));
  try {
    return await new Promise((resolve, reject) => {
      const abort = () =>
        reject(new DOMException("취소되었습니다.", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      const cleanup = () => signal.removeEventListener("abort", abort);
      worker.onmessage = ({ data }) => {
        cleanup();
        if (data.error) reject(new Error(data.error));
        else resolve(data);
      };
      worker.onerror = () => {
        cleanup();
        reject(
          new Error(
            "이미지 분석 작업을 실행하지 못했습니다. 다시 시도해주세요.",
          ),
        );
      };
      worker.postMessage(
        { data: pixels.data, width: pixels.width, height: pixels.height },
        [pixels.data.buffer],
      );
    });
  } finally {
    worker.terminate();
  }
}
