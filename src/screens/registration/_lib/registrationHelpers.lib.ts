import type { PendingQuestion } from "@engine/documents/types";
export function registrationRecords(items: PendingQuestion[], now: string) {
  return items.map((r) => ({
    asset: r.asset,
    extraAssets: r.extraAssets,
    document: r.document,
    question: {
      id: r.id,
      source: r.source,
      fragments: r.fragments,
      materialIds: r.materialIds,
      dependencyIds: r.dependencyIds,
      sectionId: r.sectionId,
      originalLabel: r.originalLabel,
      name: r.name.trim() || r.filename,
      filename: r.filename,
      memo: r.memo,
      assetId: r.asset.id,
      createdAt: now,
      updatedAt: now,
    },
  }));
}
