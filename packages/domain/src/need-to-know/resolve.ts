import type { Agency, DetailLevel, ProcessType, RoleId, Stage } from '../enums';
import type { Exclusion, NeedToKnowRow } from '../schemas/config';
import { ASP_ROWS } from './asp';
import { AWI_ROWS } from './awi';
import { CP_ROWS } from './cp';
import { EXCLUSIONS } from './exclusions';
import { MAPPA_ROWS } from './mappa';
import { MARAC_ROWS } from './marac';
import { applicableExclusions } from './parties';

export const NEED_TO_KNOW_ROWS: NeedToKnowRow[] = [...ASP_ROWS, ...CP_ROWS, ...MARAC_ROWS, ...MAPPA_ROWS, ...AWI_ROWS];

export interface ResolveContext {
  process: ProcessType;
  stage: Stage;
  /** Process flags such as criminalElement, schoolAge, children. */
  flags: Record<string, boolean>;
  /** The agency that referred, for 'referrer' audiences. */
  referrerAgency?: Agency;
}

export interface ResolvedRecipient {
  rowId: string;
  agency: Agency;
  role: RoleId | 'any';
  label: string;
  detailLevel: DetailLevel;
  fields?: string[];
  channel: NeedToKnowRow['channel'];
  trigger: string;
  reason: string;
  lawfulBasisHint: string;
}

export interface Resolution {
  recipients: ResolvedRecipient[];
  exclusions: Exclusion[];
}

export const DETAIL_RANK: Record<DetailLevel, number> = { presence: 1, fields: 2, summary: 3, full: 4 };

export function rowApplies(row: NeedToKnowRow, ctx: ResolveContext): boolean {
  if (row.process !== ctx.process || row.stage !== ctx.stage) return false;
  if (row.condition && !ctx.flags[row.condition]) return false;
  if (row.audience.agency === 'referrer' && !ctx.referrerAgency) return false;
  return true;
}

/** Recipients and exclusions for a process at a stage, given the process flags. */
export function resolveNeedToKnow(
  ctx: ResolveContext,
  rows: NeedToKnowRow[] = NEED_TO_KNOW_ROWS,
  exclusions: Exclusion[] = EXCLUSIONS,
): Resolution {
  const recipients: ResolvedRecipient[] = [];
  for (const row of rows) {
    if (!rowApplies(row, ctx)) continue;
    const agency = row.audience.agency === 'referrer' ? (ctx.referrerAgency as Agency) : row.audience.agency;
    const why = row.conditionLabel ? `${row.trigger}. ${row.conditionLabel}.` : `${row.trigger}.`;
    recipients.push({
      rowId: row.id,
      agency,
      role: row.audience.role,
      label: row.audience.label,
      detailLevel: row.detailLevel,
      fields: row.fields,
      channel: row.channel,
      trigger: row.trigger,
      reason: why,
      lawfulBasisHint: row.lawfulBasisHint,
    });
  }
  return { recipients, exclusions: applicableExclusions(ctx.process, ctx.stage, exclusions) };
}

export interface AudienceMatch {
  detailLevel: DetailLevel;
  fields: string[];
  rowIds: string[];
  reasons: string[];
  lawfulBasisHints: string[];
}

/** The highest detail level an agency and role are entitled to at a stage, with the union of named fields. */
export function matchAudience(
  agency: Agency,
  role: RoleId,
  ctx: ResolveContext,
  rows: NeedToKnowRow[] = NEED_TO_KNOW_ROWS,
): AudienceMatch | null {
  const res = resolveNeedToKnow(ctx, rows, []);
  const hits = res.recipients.filter((r) => r.agency === agency && (r.role === 'any' || r.role === role));
  if (hits.length === 0) return null;
  let best: DetailLevel = 'presence';
  const fields = new Set<string>();
  for (const h of hits) {
    if (DETAIL_RANK[h.detailLevel] > DETAIL_RANK[best]) best = h.detailLevel;
    for (const f of h.fields ?? []) fields.add(f);
  }
  return {
    detailLevel: best,
    fields: [...fields],
    rowIds: hits.map((h) => h.rowId),
    reasons: hits.map((h) => h.reason),
    lawfulBasisHints: [...new Set(hits.map((h) => h.lawfulBasisHint))],
  };
}

export function rowsForProcess(type: ProcessType, rows: NeedToKnowRow[] = NEED_TO_KNOW_ROWS): NeedToKnowRow[] {
  return rows.filter((r) => r.process === type);
}
