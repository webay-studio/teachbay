import type { EvidenceLine } from "./structure";
import type { Rect } from "./base-types";
export type NumberDecision = {
  lineId: string;
  text: string;
  rawNumber: string;
  number: number | null;
  accepted: boolean;
  reasons: string[];
  score: number;
};
type Marker = {
  raw: string;
  value: number;
  body: string;
  explicit: boolean;
  section: string;
  issue?: string;
};
function marker(text: string): Marker | undefined {
  const normalized = text.replace(/[０-９]/g, (c) =>
    String(c.charCodeAt(0) - 0xff10),
  );
  // Circled choices and parenthesized subquestions never become main numbers.
  if (/^\s*(?:[①②③④⑤⑥⑦⑧⑨⑩]|\(\s*\d+\s*\))/.test(normalized)) return;
  const m =
    /^\s*(?:(?:[\[【]?\s*)(서술형|논술형)\s*)?(\d{1,3})(?:\s*([.．、\]]|번)|(\s+)(?=[가-힣A-Za-z])|\s*$)([\s\S]*)$/.exec(
      normalized,
    );
  if (!m) return;
  const raw = m[2],
    body = m[5]?.trim() ?? "",
    value = Number(raw);
  return {
    raw,
    value,
    body,
    explicit: !!m[3] || !!m[1],
    section: m[1] ? "essay" : "main",
    issue: /^0/.test(raw)
      ? "0 또는 앞자리 0이 있는 번호는 자동 채택하지 않음"
      : m[3] && /[.．]/.test(m[3]) && /^\s*\d+[.．]\d/.test(normalized)
        ? "소수·수식의 숫자 표기"
        : undefined,
  };
}
export function readQuestionNumber(text: string): string | undefined {
  const m = marker(text);
  return m && !m.issue ? String(m.value) : undefined;
}
const prose = (s: string) =>
  /[가-힣]{2,}/.test(s) || /(?:[A-Za-z]{2,}\s+){1,}[A-Za-z]{2,}/.test(s);
const median = (v: number[]) =>
  v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0.012;
export function validateQuestionNumbers(
  lines: EvidenceLine[],
  lane: Rect,
  lineHeight: number,
) {
  const candidates = lines.flatMap((line) => {
    const parsed = marker(line.text);
    return parsed ? [{ line, parsed }] : [];
  });
  const strongReadings = candidates.filter(
    (c) =>
      !c.parsed.issue &&
      c.parsed.explicit &&
      prose(c.parsed.body) &&
      c.line.x < lane.x + lane.w * 0.25,
  );
  // Multiple OCR passes at the same physical start are one alignment observation.
  const strong = strongReadings.filter(
    (c, i) =>
      !strongReadings
        .slice(0, i)
        .some(
          (p) =>
            Math.abs(p.line.x - c.line.x) < 0.018 &&
            Math.abs(p.line.y - c.line.y) < Math.max(p.line.h, c.line.h) * 0.6,
        ),
  );
  // Learn the densest alignment band, rather than trusting a single leftmost digit.
  const bands = strong.map((c) =>
    strong.filter((p) => Math.abs(p.line.x - c.line.x) < 0.018),
  );
  const band = bands.sort((a, b) => b.length - a.length)[0] ?? [];
  const alignedX =
    band.length >= 2 ? median(band.map((c) => c.line.x)) : undefined;
  const referenceHeight =
    strong.length >= 2
      ? median(strong.map((c) => Math.min(c.line.h, lineHeight * 1.5)))
      : lineHeight;
  const decisions: NumberDecision[] = candidates.map(({ line, parsed: m }) => {
    const reasons: string[] = [];
    let score = 0,
      blocked = false;
    const reject = (reason: string) => {
      reasons.push(reason);
      blocked = true;
    };
    if (m.issue) reject(m.issue);
    if (line.x >= lane.x + Math.min(0.085, lane.w * 0.22))
      reject("단의 문항 번호 위치보다 안쪽");
    if (alignedX !== undefined && Math.abs(line.x - alignedX) > 0.032)
      reject("반복되는 문항 번호 정렬에서 벗어남");
    if (line.h < referenceHeight * 0.42 || line.h > referenceHeight * 3)
      reject("문항 시작 행과 글자 높이가 크게 다름");
    if (line.confidence !== undefined && line.confidence < 25)
      reject("번호 행 OCR 인식 신뢰도 부족");
    if (m.explicit) {
      score += 2;
      reasons.push("문항 구분 기호 또는 섹션 표기");
    }
    const sameRow = lines.find(
      (l) =>
        l.id !== line.id &&
        l.x >= line.x + line.w - 0.004 &&
        l.x - (line.x + line.w) < 0.05 &&
        Math.min(l.y + l.h, line.y + line.h) - Math.max(l.y, line.y) >
          Math.min(l.h, line.h) * 0.3 &&
        prose(l.text),
    );
    if (prose(m.body) || sameRow) {
      score += 3;
      reasons.push("번호 뒤 같은 행에 본문 연결");
    } else if (
      lines.some(
        (l) =>
          l.id !== line.id &&
          l.y >= line.y + line.h * 0.5 &&
          l.y - (line.y + line.h) < lineHeight * 2 &&
          Math.abs(l.x - line.x) < 0.035 &&
          prose(l.text),
      )
    ) {
      score += 1;
      reasons.push("다음 행 본문 근접");
    } else reject("수식·단독 숫자: 연결할 본문 근거 부족");
    if (alignedX !== undefined && Math.abs(line.x - alignedX) < 0.018) {
      score++;
      reasons.push("다른 문항 번호와 정렬 일치");
    }
    const ordered = candidates
      .filter(
        (c) =>
          !c.parsed.issue &&
          c.parsed.section === m.section &&
          c.parsed.explicit &&
          prose(c.parsed.body) &&
          Math.abs(c.line.x - line.x) < 0.035,
      )
      .sort((a, b) => a.line.y - b.line.y);
    const prev = ordered.filter((c) => c.line.y < line.y - lineHeight).at(-1),
      next = ordered.find((c) => c.line.y > line.y + lineHeight);
    const both =
      prev &&
      next &&
      prev.parsed.value < m.value &&
      m.value < next.parsed.value;
    if (
      prev?.parsed.value === m.value - 1 ||
      next?.parsed.value === m.value + 1
    ) {
      score += 2;
      reasons.push("앞뒤 문항 번호 연속성");
    }
    if (!m.explicit && !both)
      reject("구분 기호 없는 숫자는 앞뒤 번호 근거가 모두 필요");
    if (
      prev &&
      next &&
      prev.parsed.value < next.parsed.value &&
      (m.value <= prev.parsed.value || m.value >= next.parsed.value)
    )
      reject("앞뒤 번호 순서와 충돌");
    if (
      prev &&
      m.value - prev.parsed.value > 10 &&
      line.y - prev.line.y < Math.max(0.12, lineHeight * 10)
    )
      reject("가까운 앞 문항에서 번호가 크게 도약");
    if (m.value === 1 && prev && m.section === "main")
      reject("번호 재시작: 섹션 확인 필요");
    if (score < 5) reject("복수 근거 부족");
    return {
      lineId: line.id,
      text: line.text,
      rawNumber: m.raw,
      number: blocked ? null : m.value,
      accepted: !blocked,
      score,
      reasons,
    };
  });
  // Prefer the best-supported OCR reading at the same physical start.
  const accepted = decisions
    .filter((d) => d.accepted)
    .sort((a, b) => b.score - a.score);
  const winners: EvidenceLine[] = [];
  for (const d of accepted) {
    const l = lines.find((l) => l.id === d.lineId)!;
    if (
      winners.some(
        (w) =>
          Math.abs(w.y - l.y) < Math.max(w.h, l.h) * 0.6 &&
          Math.abs(w.x - l.x) < 0.05,
      )
    ) {
      d.accepted = false;
      d.number = null;
      d.reasons.push("같은 위치의 다른 OCR 번호 판정과 중복");
    } else winners.push(l);
  }
  return { anchors: winners.sort((a, b) => a.y - b.y || a.x - b.x), decisions };
}
