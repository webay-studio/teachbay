"use client";
import { useId } from "react";
import { UserRound, LogOut, ChevronDown } from "lucide-react";
import { useProfileMenuHandler } from "../_handler/ProfileMenu.handler";

export function ProfileMenuAction() {
  const {
    profileOpen,
    setProfileOpen,
    container,
    trigger,
    logoutButton,
    signOut,
  } = useProfileMenuHandler();
  const menuId = useId();
  return (
    <div
      ref={container}
      className="relative justify-self-end"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setProfileOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label="프로필 메뉴"
        aria-haspopup="menu"
        aria-expanded={profileOpen}
        aria-controls={profileOpen ? menuId : undefined}
        className="flex min-h-11 items-center gap-2 rounded-full p-1 text-muted transition-colors hover:bg-soft"
        onClick={() => setProfileOpen(!profileOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setProfileOpen(true);
          }
        }}
      >
        <span className="grid size-9 place-items-center rounded-full border border-brand/10 bg-soft text-brand">
          <UserRound size={19} aria-hidden="true" />
        </span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {profileOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="프로필"
          className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-line bg-white p-2 shadow-[0_12px_40px_#20242d14]"
        >
          <div
            className="mb-1 border-b border-line px-3 py-3"
            role="presentation"
          >
            <p className="text-xs font-semibold text-ink">내 작업실</p>
            <p className="mt-1 text-[10px] text-muted">
              이 브라우저에 자료 저장 중
            </p>
          </div>
          <button
            ref={logoutButton}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-3 text-left text-xs text-ink hover:bg-soft focus:bg-soft"
            onClick={signOut}
          >
            <LogOut size={15} aria-hidden="true" />
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
