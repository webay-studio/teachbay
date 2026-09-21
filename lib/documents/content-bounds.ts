import type { DocumentPage, Fragment, Piece, Rect, TextLine } from "./types";
export type ContentBounds = {
  state: "unresolved" | "proposal" | "chosen" | "manual" | "kept";
  proposal?: Rect;
  evidence: TextLine[];
  reason: string;
  handwriting: "not-separated";
};
const within = (l: TextLine, r: Rect) =>
  l.x + l.w / 2 >= r.x &&
  l.x + l.w / 2 <= r.x + r.w &&
  l.y >= r.y - 0.002 &&
  l.y + l.h <= r.y + r.h + 0.002;
/** A textual end is a REVIEW PROPOSAL, not a handwriting/layout classifier. */
export function assessContent(
  page: DocumentPage,
  fragment: Fragment,
  kind: Piece["kind"],
): ContentBounds {
  const rect = fragment.candidateRect ?? fragment.rect;
  const base = {
    state: "unresolved" as const,
    evidence: [] as TextLine[],
    handwriting: "not-separated" as const,
  };
  if (kind !== "question")
    return {
      ...base,
      reason: "자료·이어지는 영역은 본문 끝을 자동 확정하지 않습니다.",
    };
  const lines = page.lines
    .filter((l) => within(l, rect))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  // Require both an explicit point label and an instruction ending in nearby lines.
  const end = lines.find(
    (l, i) =>
      /[\[［【]\s*\d+(?:[.,]\d+)?\s*점\s*[\]］】]/.test(l.text) &&
      (l.confidence === undefined || l.confidence >= 50) &&
      lines
        .slice(Math.max(0, i - 3), i + 1)
        .filter((p) => l.y - (p.y + p.h) <= Math.max(l.h, p.h) * 4)
        .some((p) =>
          /구하시오|쓰시오|고르시오|답하시오|옳은\s*것|값은|것은/.test(p.text),
        ),
  );
  if (!end)
    return {
      ...base,
      reason:
        "본문 끝을 뒷받침하는 지시문·배점 근거가 부족해 넓은 원본을 유지합니다.",
    };
  const prefix = lines
    .filter((l) => l.y <= end.y + end.h)
    .map((l) => l.text)
    .join(" ");
  if (
    /그림|그래프|도형|삼각형|사각형|보기|다음\s*표|아래\s*표|표를|표에|빈칸|빈\s*칸|답안란|작성란|공통|다음\s*(?:쪽|페이지)|계속/.test(
      prefix,
    )
  )
    return {
      ...base,
      evidence: [end],
      reason:
        "그림·보기·표·답안란 또는 이어짐 단서가 있어 배점 아래를 자동으로 제외하지 않습니다.",
    };
  const padding = Math.max(end.h * 0.65, 3 / page.asset.height);
  // Include every line intersecting the end line, preserving tall maths on that row.
  const rowBottom = Math.max(
    end.y + end.h,
    ...lines
      .filter((l) => l.y <= end.y + end.h && l.y + l.h >= end.y)
      .map((l) => l.y + l.h),
  );
  const bottom = Math.min(rect.y + rect.h, rowBottom + padding);
  if (rect.y + rect.h - bottom <= Math.max(end.h * 2, 6 / page.asset.height))
    return {
      ...base,
      evidence: [end],
      reason: "줄일 수 있는 확실한 하단 영역이 없습니다.",
    };
  return {
    state: "proposal",
    proposal: { ...rect, h: bottom - rect.y },
    evidence: [end],
    handwriting: "not-separated",
    reason:
      "지시문과 배점을 본문 끝 후보로 찾았습니다. 배점 아래 수식·선택지·그림이 없는지 확인 후 적용하세요. 필기와 인쇄물을 구별한 결과는 아닙니다.",
  };
}
export function withContentBounds(
  pages: DocumentPage[],
  pieces: Piece[],
): Piece[] {
  return pieces.map((p) => ({
    ...p,
    fragments: p.fragments.map((f) => {
      const page = pages.find((page) => page.id === f.pageId);
      return page
        ? {
            ...f,
            candidateRect: f.candidateRect ?? { ...f.rect },
            content: assessContent(page, f, p.kind),
          }
        : f;
    }),
  }));
}
export function applyContentProposal(fragment: Fragment): Fragment {
  if (!fragment.content?.proposal) return fragment;
  return {
    ...fragment,
    rect: { ...fragment.content.proposal },
    content: { ...fragment.content, state: "chosen" },
  };
}
export function keepCandidate(fragment: Fragment): Fragment {
  return {
    ...fragment,
    rect: { ...(fragment.candidateRect ?? fragment.rect) },
    content: fragment.content
      ? { ...fragment.content, state: "kept" }
      : undefined,
  };
}
