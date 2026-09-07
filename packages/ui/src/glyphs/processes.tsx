import { Glyph, type GlyphProps } from './Glyph';

const fillProps = (variant: GlyphProps['variant']) => (variant === 'filled' ? { fill: 'currentColor', stroke: 'none' } : {});

/** ASP: an adult figure inside a protective arc. */
export function AspGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <circle cx="12" cy="8" r="2.6" {...f} />
      <path d="M8 18.5c0-2.5 1.8-4.2 4-4.2s4 1.7 4 4.2" {...f} />
      <path d="M4 12.5A8.5 8.5 0 0 1 20 12.5" />
    </Glyph>
  );
}

/** CP: a small figure held by a larger arc. */
export function CpGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <circle cx="12" cy="10" r="2" {...f} />
      <path d="M9 17.5c0-1.8 1.3-3 3-3s3 1.2 3 3" {...f} />
      <path d="M5 20V9a7 7 0 0 1 14 0v11" />
    </Glyph>
  );
}

/** MARAC: two overlapping circles (victim and agencies), a table. */
export function MaracGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <circle cx="9" cy="10" r="4.5" {...f} />
      <circle cx="15" cy="10" r="4.5" />
      <path d="M4 20h16" />
    </Glyph>
  );
}

/** MAPPA: layered levels. */
export function MappaGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="m12 4 8 4.5-8 4.5-8-4.5L12 4Z" {...f} />
      <path d="m4 12.5 8 4.5 8-4.5M4 16.5 12 21l8-4.5" />
    </Glyph>
  );
}

/** AWI: a head with a decision point. */
export function AwiGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M8 20v-3.5H6.5a1 1 0 0 1-.8-1.6L7 13V10a5.5 5.5 0 0 1 11 0v2.5a4 4 0 0 1-2 3.5V20" {...f} />
      <circle cx="12.5" cy="10" r="1.6" fill={p.variant === 'filled' ? 'var(--color-paper-0)' : 'none'} stroke={p.variant === 'filled' ? 'none' : 'currentColor'} />
    </Glyph>
  );
}

/** Wordmark placeholder: a lantern. */
export function LanternGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M9 3h6M12 3v2" />
      <path d="M8 7.5h8l1 9.5H7l1-9.5Z" {...f} />
      <path d="M9.5 21h5M12 17v4" />
      <path d="M12 10v4" stroke={p.variant === 'filled' ? 'var(--color-paper-0)' : 'currentColor'} />
    </Glyph>
  );
}
