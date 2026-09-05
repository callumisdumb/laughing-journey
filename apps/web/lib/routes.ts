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
  // The two-persona view, which is a demo affordance rather than a screen of the product.
  'compare',
  'inbox',
  'notifications',
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
  'admin/calendar',
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
  // The source system simulator, which is a demo affordance rather than part of the product. It is
  // prerendered like everything else because the export has no other mode; the build flag is what
  // takes it out (D-166).
  'simulator',
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
