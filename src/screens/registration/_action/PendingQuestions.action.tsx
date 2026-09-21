"use client";
import { Scissors, X, ArrowRight } from "lucide-react";
import { UploadPreview } from "../_component/UploadPreview";
import { useRegistrationHandler } from "../_handler/Registration.handler";
export function PendingQuestionsAction() {
  const { rows, reviewId, busy, reading, documents, setRows, setCrop, save } =
    useRegistrationHandler();
  return (
    <>
      {" "}
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
                  <UploadPreview asset={r.asset} />
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
    </>
  );
}
