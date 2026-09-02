import type { SVGProps } from 'react';

export type GlyphSize = 16 | 20 | 24;
export type GlyphVariant = 'outline' | 'filled';

export interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: GlyphSize;
  variant?: GlyphVariant;
  /** Accessible name. Omit when the glyph is decorative and a text label sits beside it. */
  title?: string;
}

/** Shared wrapper: 24-unit viewBox, currentColor, 1.75 stroke. */
export function Glyph({ size = 20, title, children, ...rest }: GlyphProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
