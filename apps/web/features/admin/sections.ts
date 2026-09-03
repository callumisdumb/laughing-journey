/** The admin sections in navigation order. Ids match STATIC_ROUTES admin/<id>. */
export const ADMIN_SECTIONS = [
  { id: 'labels', label: 'Copy and labels', description: 'Every label, heading and message in the product, editable with a live preview.' },
  { id: 'timescales', label: 'Timescales', description: 'Statutory and local clock rules, with their source and confidence.' },
  { id: 'forms', label: 'Forms', description: 'Forms in use and the version that applies from a date.' },
  { id: 'need-to-know', label: 'Need-to-know', description: 'Who is told what at each stage of each process, and who must not be.' },
  { id: 'agencies', label: 'Agencies', description: 'Organisations, teams and bases, as the seed holds them.' },
  { id: 'users', label: 'Users', description: 'Demo personas, their roles and cases. Sign in as any of them.' },
  { id: 'markings', label: 'Markings', description: 'Classification markings and their handling instructions.' },
  { id: 'defaults', label: 'Defaults', description: 'Theme, density, break-glass window, bank holidays and ASP eligibility.' },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]['id'];

export function isAdminSection(id: string): id is AdminSectionId {
  return ADMIN_SECTIONS.some((s) => s.id === id);
}
