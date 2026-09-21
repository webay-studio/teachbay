"use client";
import { useRef, useState } from "react";
import { ImageAsset } from "../lib/types";
import { readImage } from "../lib/images";
import { useBlobUrl } from "./shared";
export function Cropper({
  asset,
  onSave,
  onClose,
}: {
  asset: ImageAsset;
  onSave: (a: ImageAsset) => void;
  onClose: () => void;
}) {
  const url = useBlobUrl(asset.blob);
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, y: 0, w: 1, h: 1 }),
    [start, setStart] = useState<{ x: number; y: number }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function point(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }
  async function save() {
    setBusy(true);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(box.w * asset.width));
      c.height = Math.max(1, Math.round(box.h * asset.height));
      c.getContext("2d")!.drawImage(
        img,
        box.x * asset.width,
        box.y * asset.height,
        c.width,
        c.height,
        0,
        0,
        c.width,
        c.height,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        c.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("자르기에 실패했습니다."))),
          "image/png",
        ),
      );
      onSave(await readImage(blob));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "이미지 자르기에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="inline-cropper" aria-label="이미지 자르기">
      <header className="registration-review-heading">
        <h2>이미지 자르기</h2>
        <button className="btn" disabled={busy} onClick={onClose}>
          자르기 닫기
        </button>
      </header>
      <p className="muted">
        드래그해 남길 영역을 선택하세요. 아래 범위 조절로도 지정할 수 있어요.
      </p>
      <div
        className="crop-stage"
        ref={ref}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = point(e);
          setStart(p);
          setBox({ x: p.x, y: p.y, w: 0, h: 0 });
        }}
        onPointerMove={(e) => {
          if (!start) return;
          const p = point(e);
          setBox({
            x: Math.min(start.x, p.x),
            y: Math.min(start.y, p.y),
            w: Math.abs(p.x - start.x),
            h: Math.abs(p.y - start.y),
          });
        }}
        onPointerUp={() => setStart(undefined)}
      >
        <img src={url || undefined} alt="자를 원본 이미지" draggable={false} />
        <div
          className="crop-box"
          style={{
            left: `${box.x * 100}%`,
            top: `${box.y * 100}%`,
            width: `${box.w * 100}%`,
            height: `${box.h * 100}%`,
          }}
        />
      </div>
      <div className="crop-ranges">
        {(["x", "y", "w", "h"] as const).map((k, i) => (
          <label key={k}>
            {["왼쪽", "위쪽", "너비", "높이"][i]}
            <input
              type="range"
              min="0"
              max={k === "w" ? 1 - box.x : k === "h" ? 1 - box.y : 1}
              step="0.01"
              value={box[k]}
              onChange={(e) => {
                const n = { ...box, [k]: Number(e.target.value) };
                n.w = Math.min(n.w, 1 - n.x);
                n.h = Math.min(n.h, 1 - n.y);
                setBox(n);
              }}
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="actions">
        <button
          className="btn"
          onClick={() => setBox({ x: 0, y: 0, w: 1, h: 1 })}
        >
          전체 영역
        </button>
        <button
          className="btn primary"
          disabled={
            busy || box.w * asset.width < 10 || box.h * asset.height < 10
          }
          onClick={save}
        >
          {busy ? "자르는 중…" : "이 영역 사용"}
        </button>
      </div>
    </section>
  );
}
