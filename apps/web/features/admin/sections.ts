import { tKey } from '@mas/messages';

/**
 * The admin sections in navigation order. Ids match STATIC_ROUTES admin/<id>; `key` is the
 * camelCase segment under `admin.sections.*` in the message catalogue, where the label and
 * description live.
 */
export const ADMIN_SECTIONS = [
  { id: 'labels', key: 'labels' },
  { id: 'timescales', key: 'timescales' },
  { id: 'forms', key: 'forms' },
  { id: 'need-to-know', key: 'needToKnow' },
  { id: 'agencies', key: 'agencies' },
  { id: 'users', key: 'users' },
  { id: 'markings', key: 'markings' },
  { id: 'defaults', key: 'defaults' },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]['id'];

export function isAdminSection(id: string): id is AdminSectionId {
  return ADMIN_SECTIONS.some((s) => s.id === id);
}

function sectionKey(id: AdminSectionId): string {
  return ADMIN_SECTIONS.find((s) => s.id === id)?.key ?? id;
}

/** The section name, as shown in the sub-navigation, on the overview card and as the section heading. */
export function sectionLabel(id: AdminSectionId): string {
  return tKey(`admin.sections.${sectionKey(id)}.label`);
}

/** The one-line description on the overview card. */
export function sectionDescription(id: AdminSectionId): string {
  return tKey(`admin.sections.${sectionKey(id)}.description`);
}
