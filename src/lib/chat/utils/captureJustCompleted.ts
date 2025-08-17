export type CaptureState = { name?: string | null; email?: string | null };

export function captureJustCompleted(prevCap?: CaptureState, currCap?: CaptureState): boolean {
  const prevOk = !!(prevCap?.name && prevCap?.email);
  const currOk = !!(currCap?.name && currCap?.email);
  return !prevOk && currOk;
}
