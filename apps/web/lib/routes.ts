/**
 * Every path the app knows about. Static routes are listed here; entity routes are
 * generated from the seed at build time (see app/[...slug]/page.tsx).
 */
export const STATIC_ROUTES = [
  'sign-in',
  'worklist',
  'people',
  'practitioners',
  'search',
  'inbox',
  'processes',
  'meetings',
  'actions',
  'sharing',
  'connectors',
  'reports',
  'audit',
  'admin',
  'admin/labels',
  'admin/timescales',
  'admin/forms',
  'admin/need-to-know',
  'admin/server-view',
  'admin/audit-chain',
  'admin/disclosure',
  'admin/agencies',
  'admin/users',
  'admin/markings',
  'admin/defaults',
  'settings',
  'help',
] as const;

export const REPORT_KINDS = ['asp', 'cp', 'marac', 'mappa', 'awi'] as const;

export function personPath(id: string): string {
  return `/people/${id}`;
}
export function chronologyPath(id: string): string {
  return `/people/${id}/chronology`;
}
export function processPath(id: string): string {
  return `/processes/${id}`;
}
export function meetingPath(id: string): string {
  return `/meetings/${id}`;
}
export function practitionerPath(id: string): string {
  return `/practitioners/${id}`;
}
