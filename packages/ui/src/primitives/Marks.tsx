import { agencyShort, processShort, riskBandLabel, type Agency, type ProcessType, type RiskBand as Band } from '@mas/domain';
import { AlertOctagon, AlertTriangle, CheckCircle2, CircleDashed, Flag } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';
import { AGENCY_GLYPHS, PROCESS_GLYPHS, type GlyphSize } from '../glyphs';
import styles from './Marks.module.css';

export interface AgencyMarkProps {
  agency: Agency;
  /** Override the label, e.g. the organisation name. */
  label?: string;
  size?: 'sm' | 'lg';
  glyphSize?: GlyphSize;
  variant?: 'outline' | 'filled';
  /** Colour the label as well as the glyph. Only on paper-0 or paper-1. */
  coloured?: boolean;
  hideLabel?: boolean;
  className?: string;
}

export function agencyColourVar(agency: Agency): string {
  return `var(--color-agency-${agency})`;
}

export function AgencyMark({ agency, label, size = 'sm', glyphSize, variant = 'outline', coloured = false, hideLabel = false, className }: AgencyMarkProps) {
  const GlyphComponent = AGENCY_GLYPHS[agency];
  const text = label ?? agencyShort(agency);
  const style = { '--agency-colour': agencyColourVar(agency) } as CSSProperties;
  return (
    <span className={cn(styles.agency, className)} data-size={size} style={style}>
      <span className={styles.agencyGlyph}>
        <GlyphComponent size={glyphSize ?? (size === 'lg' ? 20 : 16)} variant={variant} title={hideLabel ? text : undefined} />
      </span>
      {hideLabel ? null : (
        <span className={styles.agencyLabel} data-coloured={coloured ? 'true' : undefined}>
          {text}
        </span>
      )}
    </span>
  );
}

export interface ProcessMarkProps {
  type: ProcessType;
  stage?: ReactNode;
  restricted?: boolean;
  className?: string;
  glyphSize?: GlyphSize;
}

export function ProcessMark({ type, stage, restricted = false, className, glyphSize = 16 }: ProcessMarkProps) {
  const GlyphComponent = PROCESS_GLYPHS[type];
  return (
    <span className={cn(styles.process, className)} data-mark="process" data-restricted={restricted ? 'true' : undefined}>
      <GlyphComponent size={glyphSize} variant="filled" />
      <span>{processShort(type)}</span>
      {stage ? <span className={styles.processStage}>{stage}</span> : null}
    </span>
  );
}

const RISK_ICONS: Record<Band, ReactNode> = {
  critical: <AlertOctagon size={14} aria-hidden="true" />,
  high: <AlertTriangle size={14} aria-hidden="true" />,
  medium: <Flag size={14} aria-hidden="true" />,
  low: <CheckCircle2 size={14} aria-hidden="true" />,
  unknown: <CircleDashed size={14} aria-hidden="true" />,
};

export interface RiskBandProps {
  band: Band;
  label?: ReactNode;
  size?: 'sm' | 'lg';
  className?: string;
}

/** Risk is always icon + word + colour. */
export function RiskBand({ band, label, size = 'sm', className }: RiskBandProps) {
  return (
    <span className={cn(styles.risk, className)} data-band={band} data-size={size}>
      {RISK_ICONS[band]}
      <span>{label ?? riskBandLabel(band)}</span>
    </span>
  );
}

