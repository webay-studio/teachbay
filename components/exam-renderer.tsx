"use client";
import { useEffect, useState } from "react";
import { renderUnits, dependencyErrors } from "../lib/reuse";
import { get } from "../lib/db";
import { ImageAsset, Settings, Snapshot } from "../lib/types";
import { Page, paginate } from "../lib/layout";
import { useBlobUrl } from "./shared";
export function useLayout(items: Snapshot[], settings: Settings) {
  const [assets, setAssets] = useState<Map<string, ImageAsset>>(new Map()),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const key =
    renderUnits(items)
      .map((x) => x.assetId)
      .join(",") +
    "," +
    (settings.logoId ?? "");
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    Promise.all(
      [
        ...new Set([
          ...renderUnits(items).map((i) => i.assetId),
          ...(settings.logoId ? [settings.logoId] : []),
        ]),
      ].map(async (id) => {
        const a = await get("assets", id);
        if (!a) throw new Error("이미지 자료를 찾을 수 없습니다.");
        return [id, a] as const;
      }),
    )
      .then((data) => {
        if (live) {
          setAssets(new Map(data));
          setLoading(false);
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, [key]);
  return {
    assets,
    pages: paginate(items, assets, settings),
    loading,
    error: error || dependencyErrors(items).join(" "),
  };
}
function PrintImage({
  asset,
  style,
  alt,
}: {
  asset: ImageAsset;
  style?: React.CSSProperties;
  alt: string;
}) {
  const url = useBlobUrl(asset.blob);
  return url ? (
    <img src={url} alt={alt} style={style} />
  ) : (
    <span data-image-pending>이미지 준비 중…</span>
  );
}
export function ExamRenderer({
  title,
  settings,
  assets,
  pages,
  date,
}: {
  title: string;
  settings: Settings;
  assets: Map<string, ImageAsset>;
  pages: Page[];
  date?: string;
}) {
  return (
    <div className="paper-stack" id="print-document">
      {pages.map((page, index) => (
        <section className="paper" key={index}>
          <header className="paper-header">
            {settings.logoId && assets.get(settings.logoId) && (
              <PrintImage
                asset={assets.get(settings.logoId)!}
                alt="시험지 로고"
              />
            )}
            <div>
              <span className="paper-kicker">WORKSHEET</span>
              <h2>{title || "제목 없는 시험지"}</h2>
            </div>
            <div className="paper-details">
              {settings.date && (
                <span>
                  {new Date(date ?? Date.now()).toLocaleDateString("ko-KR")}
                </span>
              )}
              {settings.nameLine && <span>이름 : ______________</span>}
            </div>
          </header>
          <div
            className="paper-columns"
            style={{ gridTemplateColumns: `repeat(${settings.columns}, 1fr)` }}
          >
            {page.columns.map((column, c) => (
              <div className="paper-column" key={c}>
                {column.map((p) => (
                  <div
                    className="paper-question"
                    key={p.item.id}
                    style={{ height: `${p.height}mm` }}
                  >
                    {(settings.numbers || p.number === 0) && (
                      <div className="question-number">
                        {p.number === 0
                          ? "공통 자료"
                          : `${String(p.number).padStart(2, "0")}${p.item.continuation ? " · 계속" : ""}${p.item.originalLabel ? ` (원문 ${p.item.originalLabel})` : ""}`}
                      </div>
                    )}
                    <div
                      className="print-image-box"
                      style={{ height: `${p.imageHeight}mm` }}
                    >
                      <PrintImage
                        asset={assets.get(p.item.assetId)!}
                        alt={p.item.name}
                        style={{ maxHeight: `${p.imageHeight}mm` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <footer className="paper-footer">
            <span>{title}</span>
            <span>
              {index + 1} / {pages.length}
            </span>
          </footer>
        </section>
      ))}
    </div>
  );
}
