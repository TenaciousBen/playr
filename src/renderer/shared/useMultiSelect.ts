import { useCallback, useEffect, useMemo, useState } from "react";

export function useMultiSelect(orderedIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);

  // Prune selection if list changes.
  useEffect(() => {
    const allowed = new Set(orderedIds);
    setSelectedIds((prev) => prev.filter((id) => allowed.has(id)));
    setAnchorId((prev) => (prev && allowed.has(prev) ? prev : null));
  }, [orderedIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setAnchorId(null);
  }, []);

  const toggleSelect = useCallback(
    (id: string, shiftKey: boolean) => {
      if (!id) return;
      const idx = orderedIds.indexOf(id);
      if (idx < 0) return;

      if (shiftKey && anchorId) {
        const aIdx = orderedIds.indexOf(anchorId);
        if (aIdx >= 0) {
          const from = Math.min(aIdx, idx);
          const to = Math.max(aIdx, idx);
          const range = orderedIds.slice(from, to + 1);
          setSelectedIds((prev) => Array.from(new Set([...prev, ...range])));
          return;
        }
      }

      setAnchorId(id);
      setSelectedIds((prev) => {
        const set = new Set(prev);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        return Array.from(set);
      });
    },
    [anchorId, orderedIds]
  );

  return {
    selectedIds,
    selectedSet,
    hasSelection: selectedIds.length > 0,
    clearSelection,
    toggleSelect
  };
}


