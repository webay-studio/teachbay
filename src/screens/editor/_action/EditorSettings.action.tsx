"use client";
import { ChevronDown } from "lucide-react";
import { useEditorHandler } from "../_handler/Editor.handler";
export function EditorSettingsAction() {
  const {
    error,
    layoutError,
    value,
    update,
    setting,
    advanced,
    setAdvanced,
    busy,
    uploadLogo,
  } = useEditorHandler();
  return (
    <>
      {" "}
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
              onChange={(e) => {
                void uploadLogo(e.target.files?.[0]);
                e.target.value = "";
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
    </>
  );
}
