import React, { useEffect, useRef } from "react";

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm();
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && ref.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose, onConfirm, open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[200]" />
      <div
        ref={ref}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-[520px] z-[210]"
      >
        <div className="p-5 border-b border-gray-700">
          <div className="text-lg font-semibold">{title}</div>
        </div>
        <div className="p-5 text-sm text-gray-300">{message}</div>
        <div className="p-5 pt-0 flex items-center justify-end space-x-3">
          <button
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            className={[
              "px-4 py-2 rounded-lg transition-colors text-sm font-medium",
              destructive ? "bg-red-600 hover:bg-red-700 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
            ].join(" ")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}


