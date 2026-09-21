"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  GripVertical,
  Printer,
  Save,
  ChevronDown,
  FileText,
  Check,
} from "lucide-react";
import { Heading, AssetImage, Empty } from "./shared";
import { ExamRenderer, useLayout } from "./exam-renderer";
import { draft, put, errorText } from "../lib/db";
import { ExamDraft, Settings } from "../lib/types";
import { printExam } from "../lib/print";
import { readImage } from "../lib/images";
export default function ExamEditor() {
  const [value, setValue] = useState<ExamDraft>(),
    [error, setError] = useState(""),
    [advanced, setAdvanced] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [drag, setDrag] = useState<number>();
  const queue = useRef(Promise.resolve());
  const router = useRouter();
  useEffect(() => {
    draft()
      .then(setValue)
      .catch((e) => setError(errorText(e)));
  }, []);
  function update(next: ExamDraft) {
    if (busy) return;
    setValue(next);
    setStatus("저장 중…");
    queue.current = queue.current
      .catch(() => {})
      .then(() => put("drafts", next))
      .then(() => setStatus("작성 중인 내용 자동 저장됨"))
      .catch((e) => {
        setError(errorText(e));
        throw e;
      });
    queue.current.catch(() => {});
  }
  if (!value)
    return (
      <div className="empty">{error || "작성 중인 시험지를 불러오는 중…"}</div>
    );
  return (
    <EditorInner
      value={value}
      update={update}
      error={error}
      setError={setError}
      advanced={advanced}
      setAdvanced={setAdvanced}
      busy={busy}
      setBusy={setBusy}
      status={status}
      drag={drag}
      setDrag={setDrag}
      save={async (pages, printing) => {
        setBusy(true);
        setError("");
        try {
          await queue.current;
          const signature = JSON.stringify({
            title: value.title,
            items: value.items,
            settings: value.settings,
          });
          const id =
            value.saved?.signature === signature
              ? value.saved.id
              : crypto.randomUUID();
          const createdAt =
            value.saved?.signature === signature
              ? value.saved.createdAt
              : new Date().toISOString();
          await put("exams", {
            id,
            title: value.title.trim() || "제목 없는 시험지",
            items: structuredClone(value.items),
            settings: { ...value.settings },
            createdAt,
            pages,
          });
          const next = { ...value, saved: { signature, id, createdAt } };
          await put("drafts", next);
          setValue(next);
          if (printing) {
            await printExam();
            setStatus("시험지를 저장하고 출력 창을 요청했습니다.");
          } else router.push(`/exams/${id}`);
        } catch (e) {
          setError(e instanceof Error ? e.message : errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
function EditorInner({
  value,
  update,
  error,
  setError,
  advanced,
  setAdvanced,
  busy,
  setBusy,
  status,
  drag,
  setDrag,
  save,
}: {
  value: ExamDraft;
  update: (v: ExamDraft) => void;
  error: string;
  setError: (s: string) => void;
  advanced: boolean;
  setAdvanced: (b: boolean) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  status: string;
  drag: number | undefined;
  setDrag: (n: number | undefined) => void;
  save: (pages: number, printing: boolean) => Promise<void>;
}) {
  const {
    assets,
    pages,
    loading,
    error: layoutError,
  } = useLayout(value.items, value.settings);
  function setting<K extends keyof Settings>(k: K, v: Settings[K]) {
    update({ ...value, settings: { ...value.settings, [k]: v } });
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= value.items.length) return;
    const items = [...value.items];
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    update({ ...value, items });
  }
  return (
    <>
      <Heading
        eyebrow="YOUR NEXT CLASS, READY"
        title="시험지 만들기"
        description="완성된 모습을 보며, 다음 수업을 준비하세요."
      >
        <div className="actions">
          <button
            className="btn"
            disabled={busy || loading || !!layoutError || !pages.length}
            onClick={() => save(pages.length, false)}
          >
            <Save size={17} />
            저장
          </button>
          <button
            className="btn primary"
            disabled={busy || loading || !!layoutError || !pages.length}
            onClick={() => save(pages.length, true)}
          >
            <Printer size={17} />
            {busy ? "준비하는 중…" : "저장하고 출력"}
          </button>
        </div>
      </Heading>
      {(error || layoutError) && (
        <div className="error no-print" role="alert">
          {error || layoutError}
        </div>
      )}
      <div className="editor-settings no-print">
        <label className="title-field">
          시험지 제목
          <input
            value={value.title}
            placeholder="시험지 제목을 입력하세요"
            maxLength={60}
            onChange={(e) => update({ ...value, title: e.target.value })}
          />
        </label>
        <div className="setting-field">
          <span>단 구성</span>
          <div className="segmented">
            {([1, 2] as const).map((n) => (
              <button
                className={value.settings.columns === n ? "chosen" : ""}
                key={n}
                onClick={() => setting("columns", n)}
              >
                {n}단
              </button>
            ))}
          </div>
        </div>
        <div className="setting-field">
          <span>풀이 공간</span>
          <div className="segmented">
            {(["small", "medium", "large"] as const).map((s, i) => (
              <button
                key={s}
                className={value.settings.space === s ? "chosen" : ""}
                onClick={() => setting("space", s)}
              >
                {["적게", "보통", "넉넉하게"][i]}
              </button>
            ))}
          </div>
        </div>
        <button
          className="text-btn"
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          세부 설정
          <ChevronDown size={15} />
        </button>
      </div>
      {advanced && (
        <div className="advanced no-print">
          {(
            [
              ["numbers", "문항 번호 표시"],
              ["nameLine", "이름 작성란"],
              ["date", "날짜 표시"],
            ] as const
          ).map(([k, label]) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={value.settings[k]}
                onChange={(e) => setting(k, e.target.checked)}
              />
              {label}
            </label>
          ))}
          <label className="btn">
            로고 이미지
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                try {
                  const a = await readImage(file);
                  await put("assets", a);
                  setting("logoId", a.id);
                } catch (e) {
                  setError(e instanceof Error ? e.message : errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {value.settings.logoId && (
            <button
              className="text-btn"
              onClick={() => setting("logoId", undefined)}
            >
              로고 제외
            </button>
          )}
          <small>원본 이미지에 있는 번호는 그대로 유지됩니다.</small>
        </div>
      )}
      <div className="editor-layout">
        <aside className="question-order no-print">
          <div className="order-heading">
            <h2>
              선택한 문제 <span>{value.items.length}</span>
            </h2>
            <Link
              className="icon"
              aria-label="내 문제에서 추가"
              href="/questions"
            >
              <Plus size={19} />
            </Link>
          </div>
          <p>드래그하거나 화살표로 순서를 바꾸세요.</p>
          {value.items.map((item, i) => (
            <div
              key={item.id}
              className="order-card"
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag !== undefined) move(drag, i);
                setDrag(undefined);
              }}
            >
              <div className="order-card-top">
                <GripVertical size={14} />
                <b>{String(i + 1).padStart(2, "0")}</b>
                <span>{item.name}</span>
                <button
                  className="icon"
                  aria-label={`${item.name} 시험지에서 제외`}
                  onClick={() =>
                    update({
                      ...value,
                      items: value.items.filter((_, n) => n !== i),
                    })
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <AssetImage id={item.assetId} alt={item.name} />
              <div className="order-buttons">
                <button
                  className="icon"
                  disabled={i === 0}
                  aria-label={`${item.name} 위로 이동`}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon"
                  disabled={i === value.items.length - 1}
                  aria-label={`${item.name} 아래로 이동`}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </div>
          ))}
          <Link href="/questions" className="btn add-question">
            <Plus size={16} />내 문제에서 가져오기
          </Link>
        </aside>
        <div className="preview-area">
          <div className="preview-toolbar no-print">
            <span>
              <FileText size={16} />
              A4 미리보기 <b>{pages.length}페이지</b>
            </span>
            <span>
              {loading
                ? "이미지 준비 중…"
                : status || "설정이 미리보기에 바로 반영됩니다."}
            </span>
          </div>
          {pages.some((p) =>
            p.columns.some((c) => c.some((i) => i.scaled)),
          ) && (
            <p className="warning no-print">
              긴 이미지가 출력 영역에 맞게 축소되었습니다. 읽기 어렵다면 1단으로
              바꾸거나 이미지를 나누어 등록하세요.
            </p>
          )}
          {value.items.length === 0 ? (
            <Empty
              title="첫 문제를 가져와볼까요?"
              description="내 문제에서 원하는 문제를 선택하면 시험지가 완성됩니다."
              href="/questions"
              label="내 문제에서 가져오기"
            />
          ) : loading ? (
            <div className="empty">시험지 배치를 준비하고 있어요…</div>
          ) : (
            <ExamRenderer
              title={value.title}
              settings={value.settings}
              assets={assets}
              pages={pages}
            />
          )}
          <div className="preview-help no-print">
            <Check size={14} />
            인쇄 창에서 프린터 또는 PDF 저장을 선택할 수 있어요.
          </div>
        </div>
      </div>
    </>
  );
}
