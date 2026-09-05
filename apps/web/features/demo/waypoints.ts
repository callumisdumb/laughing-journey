/**
 * The demonstration, as data: one waypoint per chapter of `docs/DEMO.md`.
 *
 * Each is who you are, where you are, and how the product is set. A presenter mid-sentence should
 * not be switching persona in one menu, navigating in another and setting the theme in a third; the
 * script has under twelve minutes in it and three of them were going on set-up. So the whole state
 * of a chapter is one object and one click.
 *
 * The clock is part of it. A chapter about a review meeting on the 14th is a different chapter on
 * the 2nd and on the 20th, and a waypoint that set everything except the instant would put the
 * presenter on the right screen with the wrong numbers on it.
 *
 * The ids are the chapter ids in `docs/DEMO.md` and `apps/web/e2e/demo-script.spec.ts` walks them,
 * so the script, the panel and the test cannot drift apart without one of them failing.
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
  { id: 'problem', userId: 'usr_janet_kerr', path: '/inbox', theme: 'light', density: 'comfortable', nowIso: SEEDED },
  { id: 'chronology', userId: 'usr_janet_kerr', path: '/people/per_aiden_boyle/chronology', theme: 'light', density: 'comfortable', nowIso: SEEDED },
  { id: 'needToKnow', userId: 'usr_janet_kerr', path: '/compare?process=prc_marac_docherty&left=usr_karen_findlay&right=usr_graeme_dunlop&host=1', theme: 'light', density: 'comfortable' },
  { id: 'noDoubleEntry', userId: 'usr_moira_gilmour', path: '/connectors', theme: 'light', density: 'comfortable' },
  { id: 'simulator', userId: 'usr_moira_gilmour', path: '/simulator', theme: 'light', density: 'comfortable' },
  { id: 'chain', userId: 'usr_karen_findlay', path: '/processes/prc_marac_docherty', theme: 'light', density: 'comfortable' },
  { id: 'clocks', userId: 'usr_janet_kerr', path: '/worklist', theme: 'light', density: 'comfortable' },
  { id: 'meeting', userId: 'usr_janet_kerr', path: '/meetings/mtg_aiden_review', theme: 'light', density: 'comfortable' },
  { id: 'host', userId: 'usr_moira_gilmour', path: '/admin/server-view', theme: 'light', density: 'comfortable' },
  { id: 'workbook', userId: 'usr_moira_gilmour', path: '/reports/asp?nmds=1', theme: 'light', density: 'comfortable' },
  { id: 'close', userId: 'usr_janet_kerr', path: '/', theme: 'light', density: 'comfortable', nowIso: SEEDED },
] as const;
