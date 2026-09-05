/** Shared SVG geometry for the report charts. Coordinates are viewBox units; the SVG scales to its container. */
export const GEOMETRY = { width: 640, height: 280, left: 56, right: 16, top: 20, bottom: 56 } as const;

/** Tick values from zero to a rounded maximum, at most six of them. */
export function ticksFor(maxValue: number): number[] {
  const max = Math.max(1, Math.ceil(maxValue));
  let step = 1;
  if (max > 5) {
    const raw = max / 5;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const normalised = raw / magnitude;
    step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;
  }
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/** Break a category label into lines of at most maxChars, on spaces, so neighbouring labels never collide. */
export function wrapLabel(label: string, maxChars: number): string[] {
  const words = label.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}
