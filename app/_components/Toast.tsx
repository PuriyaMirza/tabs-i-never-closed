"use client";
// A small message at the bottom of the screen that goes away by itself after
// about 5 seconds. It can carry one button, like "Undo".
import { useCallback, useEffect, useState } from "react";

export type ToastData = {
  id: number;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
};

const SHOW_FOR_MS = 5000;

/** Gives you the current toast, a way to show a new one, and a way to hide it. */
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  const show = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setToast({ id: Date.now() + Math.random(), text, actionLabel: action?.label, onAction: action?.run });
  }, []);
  const hide = useCallback(() => setToast(null), []);

  // Start a fresh 5 second timer whenever a new toast appears.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return { toast, show, hide };
}

export default function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.text}</span>
      {toast.onAction && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            onClose();
            toast.onAction?.();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
