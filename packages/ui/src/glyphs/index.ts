import type { Agency, ProcessType } from '@mas/domain';
import type { ComponentType } from 'react';
import type { GlyphProps } from './Glyph';
import {
  CourtGlyph,
  EducationGlyph,
  FireRescueGlyph,
  HealthGlyph,
  HousingGlyph,
  PoliceGlyph,
  RegulatorGlyph,
  ScraGlyph,
  SocialWorkGlyph,
  SpsGlyph,
  ThirdSectorGlyph,
} from './agencies';
import { AspGlyph, AwiGlyph, CpGlyph, LanternGlyph, MappaGlyph, MaracGlyph } from './processes';

export * from './Glyph';
export * from './agencies';
export * from './processes';

export const AGENCY_GLYPHS: Record<Agency, ComponentType<GlyphProps>> = {
  police: PoliceGlyph,
  'social-work': SocialWorkGlyph,
  health: HealthGlyph,
  education: EducationGlyph,
  housing: HousingGlyph,
  'third-sector': ThirdSectorGlyph,
  sps: SpsGlyph,
  scra: ScraGlyph,
  court: CourtGlyph,
  regulator: RegulatorGlyph,
  'fire-rescue': FireRescueGlyph,
};

export const PROCESS_GLYPHS: Record<ProcessType, ComponentType<GlyphProps>> = {
  asp: AspGlyph,
  cp: CpGlyph,
  marac: MaracGlyph,
  mappa: MappaGlyph,
  awi: AwiGlyph,
};

export { LanternGlyph as WordmarkGlyph };
