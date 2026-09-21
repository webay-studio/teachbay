"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Grid2X2,
  Plus,
  FilePenLine,
  Files,
  LogOut,
  ArrowUpRight,
  X,
  HardDrive,
} from "lucide-react";
import { auth } from "../lib/auth";
import { get } from "../lib/db";
import { ImageAsset } from "../lib/types";
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!auth.loggedIn()) router.replace("/login");
    else setReady(true);
  }, [router]);
  if (!ready) return <div className="loading">작업 공간을 여는 중…</div>;
  return (
    <div className="workspace">
      <aside className="sidebar no-print">
        <Link href="/questions" className="brand">
          <span className="brand-icon">
            <BookOpen size={22} />
          </span>
          teachbay<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">나의 작업 공간</div>
        <nav>
          {[
            ["/questions", "내 문제", Grid2X2],
            ["/questions/new", "문제 등록", Plus],
            ["/exams/new", "시험지 만들기", FilePenLine],
            ["/exams", "만든 시험지", Files],
          ].map(([href, label, Icon]) => {
            const C = Icon as typeof BookOpen;
            return (
              <Link
                className={
                  path === href ||
                  (href === "/exams" &&
                    path.startsWith("/exams/") &&
                    path != "/exams/new")
                    ? "active"
                    : ""
                }
                href={href as string}
                key={href as string}
              >
                <C size={19} />
                {label as string}
                {path === href && <span className="nav-dot" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="little-note">
            <span className="note-icon">✧</span>
            <strong>수업 준비를 더 가볍게</strong>
            <p>
              내가 모은 좋은 문제로
              <br />
              나만의 시험지를 만들어보세요.
            </p>
          </div>
          <div className="profile">
            <span className="avatar">T</span>
            <div>
              <strong>내 작업 공간</strong>
              <small>개인 강사</small>
            </div>
            <button
              className="icon"
              aria-label="작업 공간 나가기"
              onClick={() => {
                auth.logout();
                router.push("/login");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar no-print">
          <span>개인 강사를 위한 작은 작업실</span>
          <div className="topbar-right">
            <button
              className="icon compact-logout"
              aria-label="작업 공간 나가기"
              onClick={() => {
                auth.logout();
                router.push("/login");
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main>{children}</main>
        <footer className="storage-note no-print">
          <HardDrive size={14} />
          현재 자료는 이 브라우저에 저장됩니다.
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
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="heading no-print">
      <div>
        <div className="eyebrow">{eyebrow}</div>
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
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            '.modal button,.modal input,.modal textarea,.modal select,.modal a[href],.modal [tabindex="0"]',
          ),
        );
        const enabled = nodes.filter(
          (node) =>
            !node.matches(":disabled") && node.getClientRects().length > 0,
        );
        const first = enabled[0],
          last = enabled[enabled.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    document.querySelector<HTMLElement>(".modal button")?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      prev?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button aria-label="닫기" className="icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
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
