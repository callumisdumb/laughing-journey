import { Glyph, type GlyphProps } from './Glyph';

const fillProps = (variant: GlyphProps['variant']) => (variant === 'filled' ? { fill: 'currentColor', stroke: 'none' } : {});

/** Police: shield outline. */
export function PoliceGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M12 3 4.5 5.8v5.4c0 4.6 3.1 8 7.5 9.8 4.4-1.8 7.5-5.2 7.5-9.8V5.8L12 3Z" {...f} />
      {p.variant === 'filled' ? <path d="M9 12.2l2 2 4-4.4" stroke="var(--color-paper-0)" /> : <path d="M9 12.2l2 2 4-4.4" />}
    </Glyph>
  );
}

/** Social work: house with people. */
export function SocialWorkGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 10v10h13V10" {...f} />
      {p.variant === 'filled' ? (
        <g stroke="var(--color-paper-0)" fill="none">
          <circle cx="9.5" cy="13.5" r="1.4" />
          <circle cx="14.5" cy="13.5" r="1.4" />
          <path d="M7.2 19c0-1.6 1-2.6 2.3-2.6s2.3 1 2.3 2.6M12.2 19c0-1.6 1-2.6 2.3-2.6s2.3 1 2.3 2.6" />
        </g>
      ) : (
        <>
          <circle cx="9.5" cy="13.5" r="1.4" />
          <circle cx="14.5" cy="13.5" r="1.4" />
          <path d="M7.2 20c0-1.6 1-2.6 2.3-2.6s2.3 1 2.3 2.6M12.2 20c0-1.6 1-2.6 2.3-2.6s2.3 1 2.3 2.6" />
        </>
      )}
    </Glyph>
  );
}

/** Health: cross in circle. */
export function HealthGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="8.5" {...f} />
      <path d="M12 8v8M8 12h8" stroke={p.variant === 'filled' ? 'var(--color-paper-0)' : 'currentColor'} strokeWidth={2.2} />
    </Glyph>
  );
}

/** Education: open book. */
export function EducationGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M12 6.5c-1.6-1.3-3.9-1.8-7-1.5v13c3.1-.3 5.4.2 7 1.5 1.6-1.3 3.9-1.8 7-1.5V5c-3.1-.3-5.4.2-7 1.5Z" {...f} />
      <path d="M12 6.5v13" stroke={p.variant === 'filled' ? 'var(--color-paper-0)' : 'currentColor'} />
    </Glyph>
  );
}

/** Housing: key. */
export function HousingGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <circle cx="8" cy="9" r="4.5" {...f} />
      <path d="M11.5 11.5 20 20M16.5 16.5l2.2-2.2M14 14l2-2" />
      {p.variant === 'filled' ? <circle cx="7" cy="8" r="1.2" fill="var(--color-paper-0)" stroke="none" /> : <circle cx="7" cy="8" r="1" />}
    </Glyph>
  );
}

/** Third sector: two hands. */
export function ThirdSectorGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M3.5 12.5c2-1 4-1 5.5.5l2.5 2c.6.5.6 1.3 0 1.8l-3 2.2" {...f} />
      <path d="M20.5 12.5c-2-1-4-1-5.5.5L12.5 15c-.6.5-.6 1.3 0 1.8l3 2.2" {...f} />
      <path d="M12 4.5c-1.8-1.8-4.6-1-4.6 1.4 0 2 3 4.1 4.6 5.6 1.6-1.5 4.6-3.6 4.6-5.6 0-2.4-2.8-3.2-4.6-1.4Z" {...f} />
    </Glyph>
  );
}

/** Scottish Prison Service: bars. */
export function SpsGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" {...f} />
      <path d="M9 4v16M12 4v16M15 4v16" stroke={p.variant === 'filled' ? 'var(--color-paper-0)' : 'currentColor'} />
    </Glyph>
  );
}

/** Court: gavel. */
export function CourtGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="m13 6 5 5M10 9l5 5M3.5 20.5 11 13" />
      <path d="m9.5 5.5 3.5-3.5 6 6-3.5 3.5-6-6Z" {...f} />
      <path d="M13 20.5h8" />
    </Glyph>
  );
}

/** SCRA: balance. */
export function ScraGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M12 3v17M5 20h14M4 7h16" />
      <path d="M7 7 4 13h6L7 7ZM17 7l-3 6h6l-3-6Z" {...f} />
    </Glyph>
  );
}

/** Regulator (OPG, MWC, Care Inspectorate): seal. */
export function RegulatorGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M12 3 14 5.2l2.9-.4.5 2.9 2.6 1.4-1.2 2.7 1.2 2.7-2.6 1.4-.5 2.9-2.9-.4L12 20.3 10 18.4l-2.9.4-.5-2.9-2.6-1.4 1.2-2.7-1.2-2.7 2.6-1.4.5-2.9 2.9.4L12 3Z" {...f} />
      <path d="m9 11.8 2 2 4-4.2" stroke={p.variant === 'filled' ? 'var(--color-paper-0)' : 'currentColor'} />
    </Glyph>
  );
}

/** Fire and rescue: flame. */
export function FireRescueGlyph(p: GlyphProps) {
  const f = fillProps(p.variant);
  return (
    <Glyph {...p}>
      <path d="M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 12 15.5 4 4 0 0 1 8 11.5C8 9 9.5 7.5 10 5.5c1 .8 1.6 1.7 2 2.5Z" {...f} />
      <path d="M7 16.5c1.3 2.5 3 3.5 5 3.5s3.7-1 5-3.5" />
    </Glyph>
  );
}
