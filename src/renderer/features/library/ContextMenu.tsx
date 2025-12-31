import React, { useEffect, useMemo, useRef } from "react";

export function ContextMenu({
  open,
  x,
  y,
  onClose,
  onDetails,
  onRemove
}: {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onDetails: () => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && ref.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const style = useMemo<React.CSSProperties>(() => {
    const pad = 8;
    const left = Math.max(pad, Math.min(x, window.innerWidth - 180));
    const top = Math.max(pad, Math.min(y, window.innerHeight - 120));
    return { left, top };
  }, [x, y]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-2 z-[120] min-w-[160px]"
      style={style}
    >
      <button
        onClick={() => {
          onDetails();
          onClose();
        }}
        className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center space-x-3"
      >
        <i className="fas fa-info-circle text-sm"></i>
        <span>Details</span>
      </button>
      <div className="border-t border-gray-700 my-1"></div>
      <button
        onClick={() => {
          onRemove();
          onClose();
        }}
        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900 hover:text-red-300 transition-colors flex items-center space-x-3"
      >
        <i className="fas fa-trash text-sm"></i>
        <span>Remove</span>
      </button>
    </div>
  );
}


