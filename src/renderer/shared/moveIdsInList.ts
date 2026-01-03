export function moveIdsInList(ids: string[], draggedIds: string[], targetId: string): string[] {
  if (!ids.length) return ids;
  const draggedSet = new Set(draggedIds.filter(Boolean));
  if (draggedSet.size === 0) return ids;
  if (draggedSet.has(targetId)) return ids;

  // Preserve the dragged items' relative order as it appears in `ids`
  const draggedInOrder = ids.filter((id) => draggedSet.has(id));
  if (draggedInOrder.length === 0) return ids;

  const remaining = ids.filter((id) => !draggedSet.has(id));
  const insertAt = remaining.indexOf(targetId);
  if (insertAt < 0) return ids;

  return [...remaining.slice(0, insertAt), ...draggedInOrder, ...remaining.slice(insertAt)];
}


