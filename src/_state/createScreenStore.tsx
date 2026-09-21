"use client";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
export function createScreenStore<T>(initializer: StateCreator<T>) {
  const Context = createContext<StoreApi<T> | null>(null);
  function Provider({ children }: { children: ReactNode }) {
    const ref = useRef<StoreApi<T> | null>(null);
    if (!ref.current) ref.current = createStore<T>()(initializer);
    return <Context.Provider value={ref.current}>{children}</Context.Provider>;
  }
  function useScreenStore<U>(selector: (state: T) => U) {
    const store = useContext(Context);
    if (!store) throw new Error("Screen store provider is missing.");
    return useStore(store, selector);
  }
  return { Provider, useScreenStore };
}
