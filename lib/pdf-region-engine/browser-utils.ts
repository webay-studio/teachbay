import type { ImageAsset } from "./base-types";
export function checkCancelled(signal: AbortSignal) {
  if (signal.aborted)
    throw new DOMException("가져오기를 취소했습니다.", "AbortError");
}
export async function canvasAsset(
  canvas: HTMLCanvasElement,
): Promise<ImageAsset> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(
              new Error("이미지를 만들지 못했습니다. 문항 영역을 나눠주세요."),
            ),
      "image/png",
    ),
  );
  return {
    id: crypto.randomUUID(),
    blob,
    mime: "image/png",
    width: canvas.width,
    height: canvas.height,
  };
}
