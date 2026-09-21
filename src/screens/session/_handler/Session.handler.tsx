"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { openSession, closeSession, hasSession } from "../_lib/session.lib";
import { useSessionState } from "../_state/useSessionStore";
import { activeCollection } from "../_lib/sessionHelpers.lib";
export function useSessionHandler(protectedPage = false) {
  const router = useRouter();
  const path = usePathname();
  const { ready, setReady } = useSessionState();
  useEffect(() => {
    if (!protectedPage) return;
    if (!hasSession()) router.replace("/login");
    else setReady(true);
  }, [protectedPage, router, setReady]);
  function start() {
    openSession();
    router.push("/questions");
  }
  function logout() {
    setReady(false);
    closeSession();
    router.push("/login");
  }
  return { ready, start, logout, collection: activeCollection(path) };
}
