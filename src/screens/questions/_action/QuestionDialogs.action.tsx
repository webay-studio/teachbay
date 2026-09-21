"use client";
import { AssetImage } from "@ui/shared";
import { Modal } from "@/components/modal/Modal";
import { useQuestionsHandler } from "../_handler/Questions.handler";
export function QuestionDialogsAction() {
  const { zoom, setZoom, edit, setEdit, busy, saveEdit } =
    useQuestionsHandler();
  return (
    <>
      {" "}
      {zoom && (
        <Modal title={zoom.name} onClose={() => setZoom(undefined)}>
          {(zoom.fragments?.length
            ? zoom.fragments.map((f) => f.assetId)
            : [zoom.assetId]
          ).map((id, i) => (
            <AssetImage
              key={id}
              id={id}
              alt={`${zoom.name} · ${i + 1}번째 영역`}
              className="full-image"
            />
          ))}
          {zoom.memo && <p>{zoom.memo}</p>}
        </Modal>
      )}
      {edit && (
        <Modal title="문제 수정" onClose={() => setEdit(undefined)}>
          <label className="field">
            문제 이름
            <input
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
          </label>
          <label className="field">
            메모
            <textarea
              value={edit.memo}
              onChange={(e) => setEdit({ ...edit, memo: e.target.value })}
            />
          </label>
          <button
            className="btn primary"
            disabled={!edit.name.trim() || busy}
            onClick={saveEdit}
          >
            변경 저장
          </button>
        </Modal>
      )}
    </>
  );
}
