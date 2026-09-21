import { withContentBounds } from "./content-bounds";
import type {
  ColumnMode,
  DocumentPage,
  Fragment,
  Piece,
  Rect,
  TextLine,
} from "./types";
const uid = () => crypto.randomUUID();
export function marker(
  text: string,
):
  | { kind: "question" | "passage"; number?: number; group?: string }
  | undefined {
  const s = text.trim();
  const range = s.match(
    /^[\[［【(]?\s*(\d{1,3})\s*[~～〜–—-]\s*(\d{1,3})\s*[\]］】).]?/,
  );
  if (range && Number(range[2]) >= Number(range[1]))
    return {
      kind: "passage",
      group: `${Number(range[1])}–${Number(range[2])}`,
    };
  if (
    /^(?:다음\s*(?:글|지문|자료).*읽|Read the (?:following )?passage)/i.test(s)
  )
    return { kind: "passage" };
  const essay = s.match(/^[\[【]?\s*서술형\s*(\d{1,3})\s*[\]】.：:]?/);
  if (essay) return { kind: "question", number: Number(essay[1]) };
  const q = s.match(
    /^(?:문제\s*|Question\s*)?(\d{1,3})\s*(?:[.．)）](?!\d)|번(?:\s|[.)]))\s*/i,
  );
  if (q && Number(q[1]) > 0) return { kind: "question", number: Number(q[1]) };
  if (
    /^[\[【]?서술형[^\d]/.test(s) ||
    /^(?:\.\s+|\d{1,3}(?:\s+|[:：]\s*))[가-힣]/.test(s)
  )
    return { kind: "question" };
}
export { joinLines } from "../pdf-region-engine/text-lines";
export function detectColumns(lines: TextLine[], mode: ColumnMode): 1 | 2 {
  if (mode !== "auto") return Number(mode) as 1 | 2;
  const body = lines.filter((l) => l.y > 0.06 && l.y < 0.94);
  const left = body.filter((l) => l.x < 0.42 && l.x + l.w < 0.54);
  const right = body.filter((l) => l.x > 0.46 && l.x < 0.7);
  const crossing = body.filter((l) => l.x < 0.45 && l.x + l.w > 0.57);
  const pairs = left.filter((l) =>
    right.some((r) => Math.abs(l.y - r.y) < 0.035),
  );
  return left.length >= 3 &&
    right.length >= 3 &&
    pairs.length >= 2 &&
    crossing.length <= Math.max(1, body.length * 0.12)
    ? 2
    : 1;
}
function inColumn(l: TextLine, r: Rect) {
  return (
    l.x + l.w / 2 >= r.x &&
    l.x + l.w / 2 < r.x + r.w &&
    l.y > 0.025 &&
    l.y < 0.975
  );
}
export function segmentDocument(
  pages: DocumentPage[],
  mode: ColumnMode = "auto",
): Piece[] {
  const pieces: Piece[] = [];
  let material: Piece | undefined;
  let previous: Piece | undefined;
  const signatures = new Map<string, Set<number>>();
  const signature = (l: TextLine) => l.text.replace(/\d+/g, "#").trim();
  for (const page of pages)
    for (const l of page.lines)
      if ((l.y < 0.13 || l.y > 0.9) && !marker(l.text)) {
        const key = signature(l);
        if (!signatures.has(key)) signatures.set(key, new Set());
        signatures.get(key)!.add(page.index);
      }
  for (const page of pages) {
    const text = page.lines.map((l) => l.text).join(" ");
    const cover =
      page.role === "cover" ||
      ((/유의\s*사항/.test(text) ||
        (/총\s*\(?\s*\d+/.test(text) && /문항/.test(text))) &&
        /답안|시험지|문제지/.test(text));
    if (cover || page.method === "unread" || !page.lines.length) {
      pieces.push({
        id: uid(),
        name: `${page.index + 1}쪽 · ${cover ? "표지/안내문 후보" : "직접 영역 확인"}`,
        kind: "other",
        fragments: [{ pageId: page.id, rect: { x: 0, y: 0, w: 1, h: 1 } }],
        warnings: [
          cover
            ? "표지/안내문 후보입니다. 문제에 포함할지 확인하거나 제외하세요."
            : "문항 경계를 인식하지 못했습니다. 원본은 보존됩니다.",
        ],
      });
      previous = undefined;
      material = undefined;
      continue;
    }
    const ignored = page.lines.filter(
      (l) =>
        (!marker(l.text) || (l.y > 0.9 && /저작권|복제|배포/.test(l.text))) &&
        ((l.y > 0.9 &&
          /저작권|복제|배포|^[-–—\s]*\d{1,3}[-–—\s]*$/.test(l.text)) ||
          ((l.y < 0.13 || l.y > 0.9) &&
            (signatures.get(signature(l))?.size ?? 0) > 1)),
    );
    const bodyEnd = Math.min(
      0.975,
      ...ignored.filter((l) => l.y > 0.9).map((l) => l.y - 0.008),
    );
    const bodyLines = page.lines.filter((l) => !ignored.includes(l));
    const inferred = detectColumns(bodyLines, mode);
    const cols =
      mode === "auto" && page.regions?.length
        ? page.regions
        : inferred === 2
          ? [
              { x: 0.025, y: 0.025, w: 0.475, h: 0.95 },
              { x: 0.5, y: 0.025, w: 0.475, h: 0.95 },
            ]
          : [{ x: 0.025, y: 0.025, w: 0.95, h: 0.95 }];
    for (const col of cols) {
      const lines = bodyLines
        .filter((l) => inColumn(l, col) && l.y >= col.y && l.y < col.y + col.h)
        .sort((a, b) => a.y - b.y || a.x - b.x);
      if (!lines.length) continue;
      const candidates = lines
        .map((line) => ({ line, mark: marker(line.text) }))
        .filter((a) => a.mark);
      // Printed starts tend to align. Reject indented formula/list labels and lone OCR digits.
      const anchorX = candidates.length
        ? Math.min(...candidates.map((a) => a.line.x))
        : col.x;
      const anchors = candidates
        .filter(
          (a) =>
            a.line.x < Math.max(col.x + 0.1, anchorX + 0.035) &&
            (!a.line.confidence || a.line.confidence >= 25) &&
            !/^[①②③④⑤⑥]/.test(a.line.text.trim()),
        )
        .filter(
          (a, i, all) => !i || Math.abs(a.line.y - all[i - 1].line.y) > 0.006,
        );
      const startYs = anchors.map(({ line }) =>
        Math.max(
          col.y,
          Math.min(
            line.y,
            ...lines
              .filter(
                (l) =>
                  l.y < line.y &&
                  l.y + l.h >= line.y &&
                  l.x + l.w > col.x &&
                  l.x < col.x + col.w,
              )
              .map((l) => l.y),
          ) - 0.005,
        ),
      );
      const top = Math.max(col.y, Math.min(...lines.map((l) => l.y)) - 0.005),
        bottom = Math.min(bodyEnd, col.y + col.h);
      const first = startYs[0] ?? bottom;
      if (first - top > 0.025) {
        const p: Piece = {
          id: uid(),
          name: `${page.index + 1}쪽 · 소속 확인 영역`,
          kind: "other",
          continuationOf: previous?.id,
          fragments: [
            {
              pageId: page.id,
              rect: {
                x: col.x,
                y: top,
                w: col.w,
                h: Math.max(0.005, first - top - 0.005),
              },
            },
          ],
          warnings: [
            previous
              ? "앞 문항/지문의 연속일 수 있습니다. 내용을 확인한 뒤 선택 합치기로 연결하세요."
              : "머리말·공통 자료·문항 일부인지 확인하세요.",
          ],
        };
        pieces.push(p);
      }
      for (let i = 0; i < anchors.length; i++) {
        const { line, mark: m } = anchors[i];
        const y = startYs[i],
          end = i + 1 < anchors.length ? startYs[i + 1] : bottom;
        const p: Piece = {
          id: uid(),
          kind: m!.kind,
          name:
            m!.kind === "passage"
              ? `공통 자료${m!.group ? ` (${m!.group}번)` : ""}`
              : `${/^\s*[\[【]?서술형/.test(line.text) ? "서술형 " : ""}${m!.number ?? "번호 확인"}번 문제`,
          number: m!.number,
          originalLabel:
            m!.kind === "question"
              ? `${/^\s*[\[【]?서술형/.test(line.text) ? "서술형 " : ""}${m!.number ?? "확인 필요"}`
              : undefined,
          sectionId: /서술형/.test(line.text) ? "essay" : "main",
          group: m!.group,
          fragments: [
            {
              pageId: page.id,
              rect: { x: col.x, y, w: col.w, h: Math.max(0.005, end - y) },
            },
          ],
          warnings: ["원본 번호·본문·그림·풀이 공간과 경계를 확인해주세요."],
        };
        if (p.kind === "passage") material = p;
        if (p.kind === "question" && material?.group) {
          const [lo, hi] = material.group.split("–").map(Number);
          if (p.number! >= lo && p.number! <= hi) {
            p.materialIds = [material.id];
            p.group = material.group;
            p.warnings.push(
              "번호 범위로 제안한 공통 자료 연결입니다. 필요한 자료인지 확인하세요.",
            );
          } else material = undefined;
        }
        if (
          p.kind === "question" &&
          p.number !== undefined &&
          previous?.number !== undefined &&
          p.number < previous.number &&
          p.number !== 1 &&
          p.sectionId === previous.sectionId
        ) {
          p.kind = "other";
          p.name = `${p.name} · 번호 흐름 확인`;
          p.warnings.push(
            "번호가 앞 문항보다 작습니다. 필기·하위 문항·새 섹션인지 확인하세요.",
          );
        }
        pieces.push(p);
        previous = p;
      }
    }
    if (!pieces.some((p) => p.fragments.some((f) => f.pageId === page.id)))
      pieces.push({
        id: uid(),
        name: `${page.index + 1}쪽 · 영역 확인`,
        kind: "other",
        fragments: [{ pageId: page.id, rect: { x: 0, y: 0, w: 1, h: 1 } }],
        warnings: ["본문을 분리하지 못했습니다."],
      });
  }
  return withContentBounds(pages, pieces);
}
export function mergePieces(pieces: Piece[], ids: string[]): Piece[] {
  const chosen = pieces.filter((p) => ids.includes(p.id));
  if (chosen.length < 2) return pieces;
  const first = chosen[0];
  const remap = (refs: string[] = []) => [
    ...new Set(refs.map((id) => (ids.includes(id) ? first.id : id))),
  ];
  const merged = {
    ...first,
    confirmed: false,
    materialIds: remap(chosen.flatMap((p) => p.materialIds ?? [])).filter(
      (id) => id !== first.id,
    ),
    dependencyIds: remap(chosen.flatMap((p) => p.dependencyIds ?? [])).filter(
      (id) => id !== first.id,
    ),
    fragments: chosen.flatMap((p) => p.fragments),
    warnings: [
      "여러 영역을 한 항목으로 합쳤습니다. 순서와 연결 부분을 확인하세요.",
    ],
  };
  return pieces.flatMap((p) =>
    p.id === first.id
      ? [merged]
      : ids.includes(p.id)
        ? []
        : [
            {
              ...p,
              materialIds: remap(p.materialIds),
              dependencyIds: remap(p.dependencyIds),
            },
          ],
  );
}
export function splitFragment(
  piece: Piece,
  index: number,
  ratio: number,
): Piece[] {
  const f = piece.fragments[index];
  if (!f || ratio <= 0.02 || ratio >= 0.98) return [piece];
  const r = f.rect;
  const top: Fragment = {
      ...f,
      content: undefined,
      rect: { ...r, h: r.h * ratio },
    },
    bottom: Fragment = {
      ...f,
      content: undefined,
      rect: { ...r, y: r.y + r.h * ratio, h: r.h * (1 - ratio) },
    };
  return [
    {
      ...piece,
      confirmed: false,
      fragments: [...piece.fragments.slice(0, index), top],
    },
    {
      ...piece,
      id: uid(),
      confirmed: false,
      name: `${piece.name} · 나눈 영역`,
      fragments: [bottom, ...piece.fragments.slice(index + 1)],
    },
  ];
}
