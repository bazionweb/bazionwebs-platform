export function getModalTabWrapTarget<T extends { focus(): void }>(
  focusable: readonly T[],
  activeElement: object | null,
  shiftKey: boolean,
): T | undefined {
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) return undefined;
  if (shiftKey && activeElement === first) return last;
  if (!shiftKey && activeElement === last) return first;
  return undefined;
}
