"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RegistrationHeaderContext } from "@ui/documents/registration-header";
import { X } from "lucide-react";
import { useRegistrationHandler } from "../_handler/Registration.handler";
import { useSessionHandler } from "@/screens/session/_handler/Session.handler";

export function RegistrationModalAction({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready } = useSessionHandler(true);
  const { rows, documents, reviewId, reading, busy } = useRegistrationHandler();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const currentDocument = documents.find((doc) => doc.id === reviewId);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!ready) return;
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [ready]);
  function close() {
    if (busy) return;
    if (
      (rows.length || documents.length || reading) &&
      !confirm(
        "아직 저장하지 않은 등록 작업이 있어요. 닫으면 작업이 취소됩니다. 닫을까요?",
      )
    )
      return;
    setOpen(false);
  }
  if (!ready) return null;
  return (
    <dialog
      ref={dialog}
      className="registration-route-dialog"
      aria-label="문제 등록"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <AnimatePresence
        onExitComplete={() => {
          dialog.current?.close();
          router.back();
        }}
      >
        {open && (
          <motion.div
            key="registration"
            className="registration-route-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.16 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <motion.section
              className="registration-route-panel"
              initial={{ y: reduced ? 0 : 24, scale: reduced ? 1 : 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: reduced ? 0 : 16, scale: reduced ? 1 : 0.99 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
            >
              <header className="registration-route-heading">
                <div className="registration-header-title">
                  <span>문제 등록</span>
                  {currentDocument && (
                    <strong title={currentDocument.filename}>
                      {currentDocument.filename}
                    </strong>
                  )}
                </div>
                <div
                  className="registration-header-actions"
                  ref={setHeaderTarget}
                />
                <button
                  className="icon registration-route-close"
                  aria-label="문제 등록 닫기"
                  disabled={busy}
                  onClick={close}
                  autoFocus
                >
                  <X size={20} />
                </button>
              </header>
              <RegistrationHeaderContext.Provider value={headerTarget}>
                <div className="registration-route-content">{children}</div>
              </RegistrationHeaderContext.Provider>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  );
}
