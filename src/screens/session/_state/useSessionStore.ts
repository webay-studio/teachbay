"use client";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
interface SessionState {
  ready: boolean;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  setReady: (ready: boolean) => void;
}
export const useSessionStore = create<SessionState>((set) => ({
  ready: false,
  profileOpen: false,
  setProfileOpen: (profileOpen) => set({ profileOpen }),
  setReady: (ready) => set({ ready }),
}));
export function useSessionState() {
  return useSessionStore(
    useShallow((state) => ({ ready: state.ready, setReady: state.setReady })),
  );
}
