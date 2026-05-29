"use client";

import type { FiredAlert } from "@/lib/types";

interface Props {
  toasts: FiredAlert[];
  onDismiss: (id: number) => void;
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className="pointer-events-auto bg-surface border border-yellow-400/60 rounded px-4 py-2.5 cursor-pointer shadow-lg font-mono text-sm text-yellow-300 max-w-xs"
          role="alert"
        >
          {t.ticker} crossed {t.direction} ${t.target_price.toFixed(2)} — now ${t.current_price.toFixed(2)}
        </div>
      ))}
    </div>
  );
}
