"use client";
import { FileText, Check } from "lucide-react";
import { Empty } from "@ui/shared";
import { ExamRenderer } from "@ui/exam-renderer";
import { useEditorHandler } from "../_handler/Editor.handler";
export function ExamPreviewAction() {
  const { value, pages, loading, status, assets } = useEditorHandler();
  return (
    <>
      {" "}
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
        {pages.some((p) => p.columns.some((c) => c.some((i) => i.scaled))) && (
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
    </>
  );
}
