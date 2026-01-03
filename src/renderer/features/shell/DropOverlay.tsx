import React, { useEffect, useState } from "react";

export function DropOverlay({
  enabled,
  onDroppedFiles
}: {
  enabled: boolean;
  onDroppedFiles: (files: File[]) => Promise<void> | void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }

    const allowDrop = (e: DragEvent) => {
      // Ignore internal drag-and-drop (e.g. dragging audiobooks into collections).
      const types = Array.from(e.dataTransfer?.types ?? []);
      if (types.includes("application/x-playr-audiobook-id") || types.includes("application/x-playr-audiobook-ids")) return;

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setVisible(true);
    };

    const hideOnLeaveWindow = (e: DragEvent) => {
      if (!e.relatedTarget) setVisible(false);
    };

    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      setVisible(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      const files = Array.from(dt.files ?? []);
      if (files.length === 0) return;
      await onDroppedFiles(files);
    };

    window.addEventListener("dragenter", allowDrop, true);
    window.addEventListener("dragover", allowDrop, true);
    window.addEventListener("dragleave", hideOnLeaveWindow, true);
    window.addEventListener("drop", onDrop, true);

    return () => {
      window.removeEventListener("dragenter", allowDrop, true);
      window.removeEventListener("dragover", allowDrop, true);
      window.removeEventListener("dragleave", hideOnLeaveWindow, true);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [enabled, onDroppedFiles]);

  if (!visible || !enabled) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-gray-900/95 flex items-center justify-center pointer-events-none">
      <div className="text-center max-w-xl px-6">
        <div className="text-2xl font-semibold">Drop audio files or folders to add to your library</div>
        <div className="text-sm text-gray-300 mt-2">Supports mp3, m4a/m4b, flac, ogg, wav</div>
      </div>
    </div>
  );
}


