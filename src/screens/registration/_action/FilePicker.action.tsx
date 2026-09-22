"use client";
import { Plus } from "lucide-react";
import { DOCUMENT_ACCEPT } from "../_lib/registration.lib";
import { useRegistrationHandler } from "../_handler/Registration.handler";
export function FilePickerAction() {
  const { input, busy, reading, ingest, documents, rows } =
    useRegistrationHandler();
  const empty = !reading && !documents.length && !rows.length;
  return (
    <>
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
      <button
        className={empty ? "registration-drop-target" : "registration-add-file"}
        disabled={busy || reading > 0}
        onClick={() => input.current?.click()}
      >
        <Plus size={empty ? 36 : 16} strokeWidth={1.5} />
        {empty ? (
          <>
            <strong>파일을 여기에 놓아주세요</strong>
            <span>또는 클릭해서 파일 선택</span>
            <small>PDF · HWP · HWPX · JPG · PNG · WebP</small>
          </>
        ) : (
          <span>파일 추가</span>
        )}
      </button>
    </>
  );
}
