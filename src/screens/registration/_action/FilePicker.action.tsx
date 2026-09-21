"use client";
import { ImagePlus } from "lucide-react";
import { Heading } from "@ui/shared";
import { DOCUMENT_ACCEPT } from "../_lib/registration.lib";
import { useRegistrationHandler } from "../_handler/Registration.handler";
export function FilePickerAction() {
  const { input, busy, reading, ingest, documents, rows } =
    useRegistrationHandler();
  return (
    <>
      {" "}
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
        {!documents.length && !rows.length && !reading && (
          <Heading
            eyebrow="START YOUR COLLECTION"
            title="좋은 수업의 재료를 모아요."
            description="이미지, PDF, 한글 문서를 가져오세요. 필요한 문제를 골라 담을 수 있어요."
          />
        )}
        {!documents.length && !rows.length && !reading && (
          <div className="upload-welcome" aria-hidden="true">
            <ImagePlus size={36} />
            <h2>여기에 파일을 놓아주세요.</h2>
            <p>또는 아래 버튼으로 기기의 파일을 선택하세요.</p>
            <span>JPG · PNG · WEBP · PDF · HWP · HWPX</span>
          </div>
        )}
        <button
          className="btn primary"
          disabled={busy || reading > 0}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={18} />
          파일 선택
        </button>
      </div>
    </>
  );
}
