/**
 * Whether a process can be opened for this person, and whether this person can open it.
 *
 * Two separate gates, and both give reasons rather than hiding the option. A greyed action with an
 * explanation teaches the product; a missing action confuses, and the practitioner who cannot find
 * the thing they know exists concludes the product cannot do it.
 *
 * Eligibility is about the subject: an ASP inquiry needs an adult, child protection needs a child.
 * Permission is about the persona: a housing officer cannot open a MAPPA case however eligible the
 * subject is. Keeping them apart matters because the answers differ in kind, and so does the way
 * out of each: an ineligible person needs a different process, an unauthorised user needs a referral
 * to the agency that can.
 */
import { ageAt } from '../dates';
import { ROLE_DEFINITIONS, type ProcessType, type RoleId } from '../enums';
import { tKey } from '@mas/messages';
import type { Dataset } from '../schemas/dataset';
import type { Person } from '../schemas/person';
import type { Process } from '../schemas/process';

/** The age at which adult support and protection and adult incapacity law applies in Scotland. */
export const ADULT_AGE = 16;
/** The age below which a person is a child for child protection purposes. */
export const CHILD_AGE = 18;

export interface Eligibility {
  eligible: boolean;
  /** Why, in the words the screen shows, whichever way the answer went. */
  reason: string;
  /** Eligible, and something about it needs saying anyway. */
  warning?: string;
  /** What to do instead, where the answer is no and there is a route. */
  route?: string;
}

/**
 * The person's age for eligibility, which is not always a number.
 *
 * An unborn baby has no age and is a child; a person with no date of birth recorded is the case that
 * breaks a naive comparison, and the honest answer there is "not known" rather than zero.
 */
function ageOf(person: Person, now: Date): number | null {
  if (person.lifeStage === 'unborn') return -1;
  if (!person.dateOfBirth) return null;
  return ageAt(person.dateOfBirth, now);
}

export function eligibilityFor(type: ProcessType, person: Person, now: Date): Eligibility {
  const age = ageOf(person, now);
  const unborn = person.lifeStage === 'unborn';
  const name = person.givenName;

  switch (type) {
    case 'asp':
      if (unborn) return { eligible: false, reason: tKey('processes.eligibility.aspUnborn'), route: tKey('processes.eligibility.routeChildProtection') };
      if (age === null) return { eligible: false, reason: tKey('processes.eligibility.noDateOfBirth', { name }), route: tKey('processes.eligibility.routeRecordDateOfBirth') };
      if (age < ADULT_AGE) return { eligible: false, reason: tKey('processes.eligibility.aspTooYoung', { name, age }), route: tKey('processes.eligibility.routeChildProtection') };
      return { eligible: true, reason: tKey('processes.eligibility.aspYes', { name, age }), warning: age < CHILD_AGE ? tKey('processes.eligibility.bothAvailable', { name, age }) : undefined };

    case 'awi':
      if (unborn) return { eligible: false, reason: tKey('processes.eligibility.awiUnborn'), route: tKey('processes.eligibility.routeChildProtection') };
      if (age === null) return { eligible: false, reason: tKey('processes.eligibility.noDateOfBirth', { name }), route: tKey('processes.eligibility.routeRecordDateOfBirth') };
      if (age < ADULT_AGE) return { eligible: false, reason: tKey('processes.eligibility.awiTooYoung', { name, age }), route: tKey('processes.eligibility.routeChildProtection') };
      return { eligible: true, reason: tKey('processes.eligibility.awiYes', { name, age }) };

    case 'cp':
      if (unborn) return { eligible: true, reason: tKey('processes.eligibility.cpUnborn', { name }) };
      if (age === null) return { eligible: false, reason: tKey('processes.eligibility.noDateOfBirth', { name }), route: tKey('processes.eligibility.routeRecordDateOfBirth') };
      if (age >= CHILD_AGE) return { eligible: false, reason: tKey('processes.eligibility.cpTooOld', { name, age }), route: tKey('processes.eligibility.routeAdultProtection') };
      return { eligible: true, reason: tKey('processes.eligibility.cpYes', { name, age }), warning: age >= ADULT_AGE ? tKey('processes.eligibility.bothAvailable', { name, age }) : undefined };

    case 'marac':
      if (unborn) return { eligible: false, reason: tKey('processes.eligibility.maracUnborn'), route: tKey('processes.eligibility.routeChildProtection') };
      if (age === null) return { eligible: false, reason: tKey('processes.eligibility.noDateOfBirth', { name }), route: tKey('processes.eligibility.routeRecordDateOfBirth') };
      if (age < ADULT_AGE) return { eligible: false, reason: tKey('processes.eligibility.maracTooYoung', { name, age }), route: tKey('processes.eligibility.routeChildProtection') };
      return { eligible: true, reason: tKey('processes.eligibility.maracYes', { name, age }) };

    /*
     * MAPPA has no adult floor and must not be given one.
     *
     * Annex 3 Table 6 of the national guidance carries an "Under 18" age band for registered sex
     * offenders, so under-18s are managed under MAPPA and blocking it on age would be wrong in a way
     * a coordinator notices in the first minute. Where the subject is under 18 the product warns and
     * cites the Children (Care and Justice) (Scotland) Act 2024, under which under-18s are treated
     * as children across justice processes: that changes how the case is run, not whether it can be
     * opened.
     */
    case 'mappa':
      if (unborn) return { eligible: false, reason: tKey('processes.eligibility.mappaUnborn') };
      if (age === null) return { eligible: true, reason: tKey('processes.eligibility.mappaNoAge', { name }), warning: tKey('processes.eligibility.mappaNoAgeWarning') };
      return { eligible: true, reason: tKey('processes.eligibility.mappaYes', { name }), warning: age < CHILD_AGE ? tKey('processes.eligibility.mappaUnder18', { name, age }) : undefined };
  }
}

/** Every process type with its answer, so a screen can list them all rather than only the yeses. */
export function eligibilityForAll(person: Person, now: Date): Array<{ type: ProcessType; eligibility: Eligibility }> {
  return (['asp', 'cp', 'marac', 'mappa', 'awi'] as const).map((type) => ({ type, eligibility: eligibilityFor(type, person, now) }));
}

/**
 * True where a person is 16 or 17, which is the case worth naming rather than resolving.
 *
 * A 16 or 17 year old can be eligible for adult support and protection and for child protection at
 * the same time, and the ASP national minimum dataset keeps a distinct age category precisely so it
 * can be known whether young adults progress through adult or child procedures. A product that picks
 * one is hiding the most interesting decision on the screen, so both are offered and the choice is
 * recorded.
 */
export function isYoungAdult(person: Person, now: Date): boolean {
  const age = ageOf(person, now);
  return age !== null && age >= ADULT_AGE && age < CHILD_AGE;
}

export type PermissionDecision = { allowed: true } | { allowed: false; reason: string; route: string };

/**
 * Who may open each process, by role.
 *
 * Named per process rather than derived, because the answers are genuinely different: a MARAC
 * referral may come from any protocol agency, an ASP inquiry decision belongs to a council officer,
 * and a MAPPA case is opened by the responsible authorities. Roles not listed are refused with the
 * route that does exist, which is almost always a referral to the agency that can.
 */
const OPENERS: Record<ProcessType, readonly RoleId[]> = {
  asp: ['council-officer-asp', 'team-leader', 'social-worker-adults', 'mho', 'cswo', 'apc-lead-officer'],
  cp: ['social-worker-children', 'team-leader', 'cswo', 'cpc-lead-officer', 'chair'],
  marac: [
    'marac-coordinator',
    'domestic-abuse-officer',
    'detective-sergeant-ppu',
    'social-worker-children',
    'social-worker-adults',
    'team-leader',
    'idaa',
    'womens-aid-worker',
    'housing-officer',
    'health-visitor',
    'midwife',
    'gp',
    'cmhn',
    'justice-social-worker',
  ],
  mappa: ['mappa-coordinator', 'offender-management', 'justice-social-worker', 'prison-social-worker', 'cswo'],
  awi: ['mho', 'social-worker-adults', 'team-leader', 'council-officer-asp', 'cswo'],
};

/**
 * Oversight kinds that hold no cases, so cannot open one.
 *
 * `sign-off` is deliberately not among them: the Chief Social Work Officer signs off across every
 * process and holds cases, and refusing the account that carries statutory responsibility for them
 * would be a rule that only looked strict.
 */
const CANNOT_OPEN: ReadonlyArray<NonNullable<(typeof ROLE_DEFINITIONS)[RoleId]['oversight']>> = ['read-only', 'audit', 'redacted', 'admin'];
const OVERSIGHT_KEYS = { 'read-only': 'readOnly', audit: 'audit', redacted: 'redacted', admin: 'admin' } as const;

export function canOpenProcess(roleId: RoleId, type: ProcessType): PermissionDecision {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) return { allowed: false, reason: tKey('permissions.create.unknownRole'), route: tKey('permissions.create.routeAskAdmin') };
  const oversight = role.oversight;
  if (oversight && CANNOT_OPEN.includes(oversight)) {
    return { allowed: false, reason: tKey(`processes.permission.oversight.${OVERSIGHT_KEYS[oversight as keyof typeof OVERSIGHT_KEYS]}`), route: tKey(`processes.permission.route.${type}`) };
  }
  if (OPENERS[type].includes(roleId)) return { allowed: true };
  return { allowed: false, reason: tKey(`processes.permission.notYourRole.${type}`), route: tKey(`processes.permission.route.${type}`) };
}

/** Every person id a process is about, across the shapes the different types use. */
export function processSubjectIds(process: Process): string[] {
  const ids = [...process.subjectIds];
  if (process.type === 'marac') ids.push(process.detail.referral.victimPersonId, process.detail.referral.perpetratorPersonId, ...process.detail.referral.childPersonIds);
  if (process.type === 'cp' && process.detail.preBirth?.motherPersonId) ids.push(process.detail.preBirth.motherPersonId);
  if (process.type === 'mappa') ids.push(...process.detail.victimPersonIds);
  return [...new Set(ids)];
}

/**
 * Open processes of the same type already on this person.
 *
 * An open process of the same type for the same person is the second most common bad create after
 * the duplicate person record, so the screen shows the existing one with its stage and lead and
 * makes opening it the primary action. Creating a second is possible and takes an explicit reason.
 */
export function openProcessesOfType(data: Dataset, personId: string, type: ProcessType): Process[] {
  return data.processes.filter((p) => p.type === type && p.status === 'open' && processSubjectIds(p).includes(personId));
}

/** SafeLives counts a further MARAC referral within twelve months of the last as a repeat. */
export const MARAC_REPEAT_MONTHS = 12;

export interface RepeatCheck {
  repeat: boolean;
  /** The referral that makes it one, where there is one. */
  previous?: Extract<Process, { type: 'marac' }>;
  previousAt?: string;
}

/**
 * Whether a new MARAC referral for this victim is a repeat.
 *
 * A defined SafeLives measure that the product already computes and reports, so creating a referral
 * runs the check and sets the flag rather than leaving it to the coordinator to remember. Closed
 * referrals count: the measure is about the twelve months before this one, not about what is open.
 */
export function maracRepeatCheck(data: Dataset, victimPersonId: string, now: Date): RepeatCheck {
  const cutoff = new Date(now.getTime());
  cutoff.setMonth(cutoff.getMonth() - MARAC_REPEAT_MONTHS);
  const since = cutoff.toISOString();

  const previous = data.processes
    .filter((p): p is Extract<Process, { type: 'marac' }> => p.type === 'marac')
    .filter((p) => p.detail.referral.victimPersonId === victimPersonId)
    .filter((p) => p.detail.referral.receivedAt >= since && p.detail.referral.receivedAt <= now.toISOString())
    .sort((a, b) => (a.detail.referral.receivedAt < b.detail.referral.receivedAt ? 1 : -1))[0];

  return previous ? { repeat: true, previous, previousAt: previous.detail.referral.receivedAt } : { repeat: false };
}
