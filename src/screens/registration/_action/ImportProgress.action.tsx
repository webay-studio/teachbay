"use client";
import { useRegistrationHandler } from "../_handler/Registration.handler";
export function ImportProgressAction() {
  const { errors, setErrors, reading, progress, cancel } =
    useRegistrationHandler();
  return (
    <>
      {" "}
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
    </>
  );
}
