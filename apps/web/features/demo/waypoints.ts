/**
 * The demonstration, as data.
 *
 * Each waypoint is one row of `docs/DEMO.md`: who you are, where you are, and how the product is
 * set. A presenter mid-sentence should not be switching persona in one menu, navigating in another
 * and setting the theme in a third; the recording has eleven minutes in it and three of them were
 * going on set-up. So the whole state of a chapter is one object and one click.
 *
 * The clock is part of it. A chapter about a review meeting on the 14th is a different chapter on
 * the 2nd and on the 20th, and a waypoint that set everything except the instant would put the
 * presenter on the right screen with the wrong numbers on it.
 */
export interface Waypoint {
  id: string;
  userId: string;
  path: string;
  theme: 'light' | 'dark';
  density: 'comfortable' | 'compact';
  /** The demo instant this chapter is written against. Omitted means leave the clock alone. */
  nowIso?: string;
}

const SEEDED = '2026-09-02T09:00:00+01:00';

export const WAYPOINTS: readonly Waypoint[] = [
  { id: 'home', userId: 'usr_janet_kerr', path: '/', theme: 'light', density: 'comfortable', nowIso: SEEDED },
  { id: 'aiden', userId: 'usr_janet_kerr', path: '/processes/prc_cp_aiden', theme: 'light', density: 'comfortable', nowIso: SEEDED },
  { id: 'chronology', userId: 'usr_janet_kerr', path: '/people/per_aiden_boyle/chronology', theme: 'light', density: 'comfortable' },
  { id: 'meeting', userId: 'usr_janet_kerr', path: '/meetings/mtg_aiden_review', theme: 'light', density: 'comfortable' },
  { id: 'marac', userId: 'usr_karen_findlay', path: '/processes/prc_marac_docherty', theme: 'light', density: 'comfortable' },
  { id: 'maracMeeting', userId: 'usr_karen_findlay', path: '/meetings/mtg_docherty_marac', theme: 'light', density: 'comfortable' },
  { id: 'marion', userId: 'usr_moira_gilmour', path: '/processes/prc_asp_marion', theme: 'light', density: 'comfortable' },
  { id: 'restricted', userId: 'usr_moira_gilmour', path: '/processes/prc_mappa_derek', theme: 'light', density: 'comfortable' },
  { id: 'compare', userId: 'usr_janet_kerr', path: '/compare?process=prc_marac_docherty&left=usr_karen_findlay&right=usr_graeme_dunlop&host=1', theme: 'light', density: 'comfortable' },
  { id: 'serverView', userId: 'usr_moira_gilmour', path: '/admin/server-view', theme: 'light', density: 'comfortable' },
  { id: 'whatWouldTheySee', userId: 'usr_janet_kerr', path: '/sharing?tab=preview', theme: 'light', density: 'comfortable' },
  { id: 'workbook', userId: 'usr_moira_gilmour', path: '/reports/asp?nmds=1', theme: 'light', density: 'comfortable' },
  { id: 'simulator', userId: 'usr_janet_kerr', path: '/simulator', theme: 'light', density: 'comfortable' },
] as const;
