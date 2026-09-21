"use client";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { useSessionStore } from "../_state/useSessionStore";
import { useSessionHandler } from "./Session.handler";

export function useProfileMenuHandler() {
  const { profileOpen, setProfileOpen } = useSessionStore(
    useShallow((state) => ({
      profileOpen: state.profileOpen,
      setProfileOpen: state.setProfileOpen,
    })),
  );
  const { logout } = useSessionHandler();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const logoutButton = useRef<HTMLButtonElement>(null);

  useEffect(() => () => setProfileOpen(false), [setProfileOpen]);
  useEffect(() => {
    if (!profileOpen) return;
    logoutButton.current?.focus();
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [profileOpen, setProfileOpen]);

  function signOut() {
    setProfileOpen(false);
    logout();
  }
  return {
    profileOpen,
    setProfileOpen,
    container,
    trigger,
    logoutButton,
    signOut,
  };
}
