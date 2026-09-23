import type { ImportProgress, PendingQuestion } from "@engine/documents/types";

const progressGuidance: Record<
  NonNullable<ImportProgress["stage"]>,
  { message: string; detail: string }
> = {
  rendering: {
    message: "원본 페이지를 불러오고 있어요.",
    detail: "작은 글자와 그림도 살펴볼 수 있도록 페이지를 준비해요.",
  },
  locating: {
    message: "문제와 글자의 위치를 살펴보고 있어요.",
    detail: "원본의 글자 정보와 그림을 함께 살펴봐요.",
  },
  "ocr-loading": {
    message: "글자를 읽을 준비를 하고 있어요.",
    detail:
      "처음에는 글자 인식에 필요한 자료를 불러오느라 조금 더 걸릴 수 있어요.",
  },
  "ocr-page": {
    message: "페이지 전체의 글자를 읽고 있어요.",
    detail: "이미지 속 글자를 읽으며 문제의 시작 위치를 찾아요.",
  },
  "ocr-detail": {
    message: "놓친 글자가 있는지 한 번 더 살펴볼게요.",
    detail: "떨어져 있는 짧은 글자와 번호를 다른 읽기 방식으로 확인해요.",
  },
  "ocr-column": {
    message: "각 단을 나눠서 자세히 읽고 있어요.",
    detail: "나란히 놓인 글이 섞이지 않도록 구역별로 살펴봐요.",
  },
  "ocr-number-check": {
    message: "문제 번호를 한 번 더 확인하고 있어요.",
    detail: "번호를 찾지 못했거나 순서가 어긋난 부분을 다시 읽어요.",
  },
  "ocr-number-zoom": {
    message: "문제 번호가 있는 부분을 확대해서 읽고 있어요.",
    detail: "작은 숫자를 놓치지 않도록 원본을 더 크게 펼쳐 확인해요.",
  },
  "ocr-pagination": {
    message: "페이지 번호를 확대해서 확인하고 있어요.",
    detail: "문제 번호와 섞이지 않도록 페이지 위쪽의 숫자를 따로 읽어요.",
  },
  "ocr-reuse": {
    message: "이미 읽은 부분의 결과를 가져오고 있어요.",
    detail: "같은 부분을 다시 읽지 않고 앞서 확인한 내용을 이어서 사용해요.",
  },
  "shape-check": {
    message: "글자와 그림의 모양을 살펴보고 있어요.",
    detail: "문제에 포함할 부분을 찾기 위해 글자와 선, 그림을 구분해 봐요.",
  },
  "page-ready": {
    message: "이 페이지의 글자와 위치를 확인했어요.",
    detail: "모든 페이지를 읽은 뒤 이어지는 문제와 지문을 함께 정리해요.",
  },
  assembling: {
    message: "페이지에 걸쳐 이어지는 문제를 정리하고 있어요.",
    detail:
      "다음 쪽으로 이어진 내용과 여러 문제에 필요한 공통 지문을 연결해요.",
  },
};

export function registrationProgressMessage(progress?: ImportProgress) {
  if (progress?.stage) return progressGuidance[progress.stage].message;
  const stage = progress?.message.split(" · ").at(-1) ?? "";
  if (/OCR/i.test(stage)) return "글자를 읽고 있어요.";
  if (/렌더링|문서 여는/.test(stage)) return "원본을 불러오고 있어요.";
  if (/문제 영역/.test(stage)) return "문제의 위치를 찾고 있어요.";
  if (/관측 확보 완료|분석 완료/.test(stage))
    return progress && progress.current >= progress.total
      ? "문제와 지문을 정리하고 있어요."
      : "이 페이지를 확인했어요.";
  if (/이미지 확인/.test(stage)) return "이미지를 확인하고 있어요.";
  return "파일을 확인하고 있어요.";
}

export function registrationProgressDetail(progress?: ImportProgress) {
  return progress?.stage
    ? progressGuidance[progress.stage].detail
    : "페이지를 살펴보며 문제와 지문을 찾고 있어요.";
}

export function registrationRecords(items: PendingQuestion[], now: string) {
  return items.map((r) => ({
    asset: r.asset,
    extraAssets: r.extraAssets,
    document: r.document,
    question: {
      id: r.id,
      bundle: r.bundle,
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
