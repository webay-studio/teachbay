import { ImageAsset } from "./types";
export async function readImage(blob: Blob): Promise<ImageAsset> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
    throw new Error("JPG, PNG, WebP 이미지만 등록할 수 있어요.");
  if (blob.size > 20 * 1024 * 1024)
    throw new Error("이미지 한 장은 20MB 이하로 올려주세요.");
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error();
    return {
      id: crypto.randomUUID(),
      blob,
      mime: blob.type,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  } catch {
    throw new Error("이미지를 읽을 수 없어요. 다른 파일을 선택해주세요.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
