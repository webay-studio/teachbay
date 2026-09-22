"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Files, ArrowUpRight, HardDrive } from "lucide-react";
import { ProfileMenuAction } from "@/screens/session/_action/ProfileMenu.action";
import { useSessionHandler } from "@/screens/session/_handler/Session.handler";
import { get } from "../lib/db";
import { ImageAsset } from "../lib/types";
export function Brand() {
  return (
    <Link
      href="/questions"
      className="studio-brand inline-flex shrink-0 items-center gap-2"
      aria-label="teachbay teaching studio 홈"
    >
      <img src="/teachbay-symbol.png" alt="" width={36} height={36} />
    </Link>
  );
}
export function Shell({
  children,
  mainClassName,
}: {
  children: React.ReactNode;
  mainClassName?: string;
}) {
  const { ready, collection } = useSessionHandler(true);
  if (!ready) return <div className="loading">작업 공간을 여는 중…</div>;
  const isQuestions = collection === "questions";
  return (
    <div className="workspace studio-workspace">
      <a href="#studio-main" className="skip-link no-print">
        본문으로 바로가기
      </a>
      <header className="studio-header mx-auto grid min-h-24 w-full max-w-[1320px] grid-cols-[auto_1fr_auto] items-center gap-8 px-11 py-6 max-[900px]:gap-5 max-[900px]:px-[26px] max-[900px]:py-[22px] max-[600px]:min-h-[82px] max-[600px]:gap-4 max-[600px]:p-5 no-print">
        <Brand />
        <nav
          className="studio-nav flex min-w-0 items-center gap-7 max-[900px]:gap-5 max-[600px]:gap-4 whitespace-nowrap"
          aria-label="주 메뉴"
        >
          <Link
            href="/questions"
            className={isQuestions ? "active" : ""}
            aria-current={isQuestions ? "page" : undefined}
          >
            내 문제
          </Link>
          <Link
            href="/exams"
            className={collection === "exams" ? "active" : ""}
            aria-current={collection === "exams" ? "page" : undefined}
          >
            만든 시험지
          </Link>
        </nav>
        <ProfileMenuAction />
      </header>
      <div className="main-wrap">
        <main id="studio-main" className={mainClassName}>
          {children}
        </main>
        <footer className="studio-footer mx-auto mt-auto flex w-full max-w-[1232px] items-center justify-between gap-5 border-t border-line px-0 py-7 text-[#747f93] max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-3.5 max-[600px]:py-[23px] no-print">
          <span className="inline-flex items-center">
            <img
              src="/teachbay-symbol.png"
              alt="teachbay"
              width={28}
              height={28}
            />
            <small>좋은 수업을 위한 작은 여유.</small>
          </span>
          <span>
            <HardDrive size={13} /> 자료는 이 브라우저에 저장됩니다.
          </span>
        </footer>
      </div>
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="heading no-print">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function useAsset(id?: string) {
  const [asset, setAsset] = useState<ImageAsset>();
  useEffect(() => {
    let live = true;
    setAsset(undefined);
    if (id)
      get("assets", id)
        .then((a) => {
          if (live) setAsset(a);
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return asset;
}
export function useBlobUrl(blob?: Blob) {
  const [value, setValue] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) {
      setValue(undefined);
      return;
    }
    const url = URL.createObjectURL(blob);
    setValue({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return value?.blob === blob ? (value?.url ?? "") : "";
}
export function AssetImage({
  id,
  alt,
  ...props
}: {
  id: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const asset = useAsset(id);
  const url = useBlobUrl(asset?.blob);
  return url ? (
    <img src={url} alt={alt} {...props} />
  ) : (
    <div className="image-loading">이미지 불러오는 중…</div>
  );
}
export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Files size={30} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="btn primary" href={href}>
        {label}
        <ArrowUpRight size={17} />
      </Link>
    </div>
  );
}

export { Modal } from "@/components/modal/Modal";
