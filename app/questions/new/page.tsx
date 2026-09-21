"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Scissors, X, ArrowRight } from "lucide-react";
import { Shell, useBlobUrl } from "../../../components/shared";
import { Cropper } from "../../../components/cropper";
import { ImageAsset } from "../../../lib/types";
import { readImage } from "../../../lib/images";
import { saveQuestions, errorText } from "../../../lib/db";
import { DocumentReview } from "../../../components/documents/document-review";
import {
  importDocument,
  isDocument,
  DOCUMENT_ACCEPT,
} from "../../../lib/documents/import";
import type {
  ImportedDocument,
  ImportProgress,
  PendingQuestion,
} from "../../../lib/documents/types";
function Preview({ asset }: { asset: ImageAsset }) {
  const u = useBlobUrl(asset.blob);
  return <img src={u || undefined} alt="등록할 문제 미리보기" />;
}
export default function UploadPage() {
  const [rows, setRows] = useState<PendingQuestion[]>([]),
    [errors, setErrors] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [reading, setReading] = useState(0),
    [crop, setCrop] = useState<string>();
  const [documents, setDocuments] = useState<ImportedDocument[]>([]);
  const documentsRef = useRef(documents);
  documentsRef.current = documents;
  const [reviewId, setReviewId] = useState<string>();
  const [progress, setProgress] = useState<ImportProgress>();
  const removeInk = true;
  const importing = useRef(false);
  const cancel = useRef<AbortController | undefined>(undefined);
  useEffect(
    () => () => {
      cancel.current?.abort();
    },
    [],
  );
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function ingest(files: File[]) {
    if (importing.current || busy) return;
    importing.current = true;
    setReading(1);
    const controller = new AbortController();
    cancel.current = controller;
    try {
      for (const file of files) {
        if (controller.signal.aborted) break;
        try {
          if (isDocument(file)) {
            const doc =
              /\.pdf$/i.test(file.name) || file.type === "application/pdf"
                ? await (
                    await import("../../../lib/documents/pdf-registration")
                  ).importPdfQuestions(
                    file,
                    setProgress,
                    controller.signal,
                    removeInk,
                  )
                : await importDocument(file, setProgress, controller.signal);
            setDocuments((prev) => [...prev, doc]);
          } else {
            setProgress({
              current: 0,
              total: 1,
              message: `${file.name} · 이미지 확인 중`,
            });
            const asset = await readImage(file);
            if (!controller.signal.aborted)
              setRows((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  name: file.name.replace(/\.[^.]+$/, "") || "붙여넣은 문제",
                  filename: file.name,
                  memo: "",
                  asset,
                },
              ]);
          }
        } catch (e) {
          if (controller.signal.aborted) break;
          setErrors((prev) => [
            ...prev,
            `${file.name}: ${e instanceof Error ? e.message : "파일을 읽지 못했습니다."}`,
          ]);
        }
      }
    } finally {
      importing.current = false;
      setReading(0);
      setProgress(undefined);
    }
  }
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (busy) return;
      if (
        e.target instanceof HTMLElement &&
        e.target.closest('input,textarea,[contenteditable="true"]')
      )
        return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (files.length) {
        e.preventDefault();
        void ingest(files);
      }
    };
    document.addEventListener("paste", paste);
    return () => document.removeEventListener("paste", paste);
  }, [busy, removeInk]);
  async function persist(items: PendingQuestion[]) {
    const now = new Date().toISOString();
    await saveQuestions(
      items.map((r) => ({
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
      })),
    );
  }
  async function save() {
    setBusy(true);
    try {
      await persist(rows);
      router.push("/questions");
    } catch (e) {
      setErrors((prev) => [...prev, errorText(e)]);
      setBusy(false);
    }
  }
  return (
    <Shell>
      <div
        className="registration-page"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!busy && !reading) void ingest(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          hidden
          ref={input}
          type="file"
          multiple
          accept={`image/jpeg,image/png,image/webp,${DOCUMENT_ACCEPT}`}
          onChange={(e) => {
            void ingest(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <div className="registration-file-action">
          <button
            className="btn primary"
            disabled={busy || reading > 0}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={18} />
            파일 선택
          </button>
        </div>
        {errors.length > 0 && (
          <div className="error" role="alert">
            {errors.map((e, i) => (
              <div key={i}>{e}</div>
            ))}
            <button className="text-btn" onClick={() => setErrors([])}>
              알림 닫기
            </button>
          </div>
        )}
        {reading > 0 && (
          <div className="import-progress" role="status">
            <div>
              <strong>{progress?.message ?? "파일을 확인하고 있어요…"}</strong>
              <p>스캔 문서는 OCR 분석에 시간이 걸릴 수 있어요.</p>
              <progress
                max={progress?.total ?? 1}
                value={progress?.current ?? 0}
              />
            </div>
            <button className="btn" onClick={() => cancel.current?.abort()}>
              가져오기 취소
            </button>
          </div>
        )}
        {documents.length > 0 && (
          <div className="registration-file-list" aria-label="검토할 파일 목록">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`registration-file-row ${reviewId === doc.id ? "active" : ""}`}
              >
                <button
                  className="file-review-open"
                  disabled={busy}
                  aria-pressed={reviewId === doc.id}
                  onClick={() => setReviewId(doc.id)}
                >
                  <strong>{doc.filename}</strong>
                  <span>
                    {doc.pages.length}쪽 · {doc.pieces.length}개 영역
                  </span>
                  <b>{reviewId === doc.id ? "검토 중" : "검토"}</b>
                </button>
                <button
                  className="icon"
                  disabled={busy}
                  aria-label={`${doc.filename} 등록에서 제외`}
                  onClick={() => {
                    if (confirm("이 파일을 등록 목록에서 제외할까요?")) {
                      setDocuments((prev) =>
                        prev.filter((d) => d.id !== doc.id),
                      );
                      if (reviewId === doc.id) setReviewId(undefined);
                    }
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {reviewId && documents.find((doc) => doc.id === reviewId) && (
          <DocumentReview
            key={reviewId}
            document={documents.find((doc) => doc.id === reviewId)!}
            onDraftChange={(pieces, selectedIds) => {
              setDocuments((prev) =>
                prev.map((doc) =>
                  doc.id === reviewId ? { ...doc, pieces, selectedIds } : doc,
                ),
              );
            }}
            onBusyChange={setBusy}
            onAccept={async (items) => {
              await persist(items);
              const remaining = documentsRef.current.filter(
                (doc) => doc.id !== reviewId,
              );
              setDocuments(remaining);
              setReviewId(remaining[0]?.id);
              if (!remaining.length && !rows.length && !importing.current)
                router.push("/questions");
            }}
          />
        )}
        {rows.length > 0 && !reviewId && (
          <>
            <div className="section-title">
              <h2>
                등록할 문제 <span>{rows.length}</span>
              </h2>
              <p>공통 지문과 문제는 각각 한 항목으로 저장됩니다.</p>
            </div>
            <div className="upload-grid">
              {rows.map((r) => (
                <article className="upload-card" key={r.id}>
                  <div className="upload-preview">
                    <Preview asset={r.asset} />
                    <button
                      className="icon remove-upload"
                      disabled={busy}
                      aria-label={`${r.name} 제외`}
                      onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
                    >
                      <X size={18} />
                    </button>
                    <button
                      className="btn crop-button"
                      disabled={busy || !!r.fragments?.length}
                      title={
                        r.fragments?.length
                          ? "문서 영역은 분리 확인 화면에서 조절합니다."
                          : undefined
                      }
                      onClick={() => setCrop(r.id)}
                    >
                      <Scissors size={14} />
                      자르기
                    </button>
                  </div>
                  {r.source && (
                    <div className="piece-tags">
                      <span>
                        {r.source.kind === "passage"
                          ? "공통 지문"
                          : r.source.kind === "question"
                            ? "문제"
                            : "자료"}
                      </span>
                      <span>{r.source.pages.join(", ")}쪽</span>
                    </div>
                  )}
                  <label className="field">
                    문제 이름
                    <input
                      disabled={busy}
                      value={r.name}
                      onChange={(e) =>
                        setRows(
                          rows.map((x) =>
                            x.id === r.id ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    메모 <span className="optional">선택</span>
                    <textarea
                      disabled={busy}
                      placeholder="기억해둘 내용을 적어보세요"
                      value={r.memo}
                      onChange={(e) =>
                        setRows(
                          rows.map((x) =>
                            x.id === r.id ? { ...x, memo: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
            <div className="save-footer">
              <span>
                {documents.length
                  ? `문서 ${documents.length}개의 분리 결과를 먼저 검토하거나 제외해주세요.`
                  : "원본 화질로 보관해 선명하게 출력해요."}
              </span>
              <button
                className="btn primary"
                disabled={busy || reading > 0 || documents.length > 0}
                onClick={save}
              >
                {busy ? "저장하는 중…" : `문제 ${rows.length}개 저장`}
                <ArrowRight size={17} />
              </button>
            </div>
          </>
        )}
        {crop && rows.find((r) => r.id === crop) && (
          <Cropper
            asset={rows.find((r) => r.id === crop)!.asset}
            onClose={() => setCrop(undefined)}
            onSave={(asset) => {
              setRows(rows.map((r) => (r.id === crop ? { ...r, asset } : r)));
              setCrop(undefined);
            }}
          />
        )}
      </div>
    </Shell>
  );
}
