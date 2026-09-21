"use client";
import { useBlobUrl } from "@ui/shared";
import type { ImageAsset } from "@engine/types";
export function UploadPreview({ asset }: { asset: ImageAsset }) {
  const url = useBlobUrl(asset.blob);
  return <img src={url || undefined} alt="등록할 문제 미리보기" />;
}
