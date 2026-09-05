/**
 * Opening a process: the reference, the first stage, the clocks, the classification and the shape of
 * the detail the opening stage needs.
 *
 * The list in `docs/RECORDS.md` section 4.4 is the product. A create that records the referral and
 * forgets the clock is a form; the whole point of this product is that the statutory deadline starts
 * counting the moment the concern is recorded and appears on Home before the practitioner has looked
 * away. So the consequences of opening live here, in one place, rather than in the dialog that
 * happens to be on screen.
 *
 * The detail this builds is the opening stage only. An ASP inquiry needs a three-point test before
 * it can proceed and a MARAC needs a DAQ before it goes to a meeting; both are recorded by their own
 * dialogs afterwards, and what an opening needs is enough to be a valid record of the concern.
 */
import { classify } from '../classification/classify';
import type { Agency, ProcessType, Stage } from '../enums';
import { tKey } from '@mas/messages';
import type { Classification } from '../classification/classify';
import type { AspDetail, AwiDetail, CpDetail, MappaDetail, MaracDetail, Process } from '../schemas/process';

/** The stage a process of each type opens at, which is the first entry in its own stage list. */
export const OPENING_STAGE: Record<ProcessType, Stage> = {
  asp: 'concern',
  cp: 'concern',
  marac: 'referral',
  mappa: 'notification',
  awi: 'capacity-concern',
};

/**
 * The clocks an opening starts, which is fewer than it first looks.
 *
 * A clock starts at the trigger its own rule names, not at whatever create happens to be on screen,
 * and reading the rules rather than assuming changed the answer. Only the two ASP clocks are
 * triggered by the concern being received. `cp.cppm.initial` is triggered by the investigation
 * beginning at the IRD, so a child protection *concern* starts nothing; a pre-birth concern starts
 * `cp.prebirth.cppm`, which is triggered by the concern being raised. Both MARAC clocks and both
 * MAPPA review clocks are triggered by a meeting being held, and the MHO report clock by notification
 * of a guardianship application.
 *
 * So opening a MARAC referral starts no clock, and that is correct rather than an omission. The
 * screen says which clocks started and, where none did, what will start them, because a practitioner
 * who expects a countdown and sees none needs to know which of the two it is (D-137).
 */
export function openingClockRuleIds(input: Pick<OpeningInput, 'type' | 'preBirth'>): string[] {
  switch (input.type) {
    case 'asp':
      return ['asp.inquiry.decision', 'asp.caseconference.initial'];
    case 'cp':
      return input.preBirth ? ['cp.prebirth.cppm'] : [];
    case 'marac':
    case 'mappa':
    case 'awi':
      return [];
  }
}

/** What starts the clocks an opening does not, so the screen can say so rather than stay silent. */
export function clocksThatWaitFor(type: ProcessType): string | null {
  switch (type) {
    case 'cp':
      return tKey('processes.open.waitsFor.cp');
    case 'marac':
      return tKey('processes.open.waitsFor.marac');
    case 'mappa':
      return tKey('processes.open.waitsFor.mappa');
    case 'awi':
      return tKey('processes.open.waitsFor.awi');
    case 'asp':
      return null;
  }
}

/** The reference prefix each process type uses locally. */
const PREFIX: Record<ProcessType, string> = { asp: 'ASP', cp: 'CP', marac: 'MARAC', mappa: 'MAPPA', awi: 'AWI' };

/**
 * A reference in the local format, continuing the sequence rather than restarting it.
 *
 * The seed's references run `ASP-2026-0217`, so a new one has to look like the ones beside it. The
 * sequence is taken from the highest number already used in the year, which is what a local numbering
 * scheme does and what makes a new reference sit sensibly in a list rather than starting at 0001
 * beside four-digit neighbours.
 */
export function nextReference(existing: Process[], type: ProcessType, now: Date): string {
  const year = now.getFullYear();
  const prefix = `${PREFIX[type]}-${year}-`;
  const highest = existing
    .filter((p) => p.reference.startsWith(prefix))
    .map((p) => Number.parseInt(p.reference.slice(prefix.length), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
}

/** The classification an opening derives, from the rules rather than from a picker. */
export function openingClassification(type: ProcessType): { classification: Classification; restricted: boolean } {
  const result = classify({ process: type });
  return { classification: result.classification, restricted: type === 'mappa' };
}

export interface OpeningInput {
  type: ProcessType;
  subjectIds: string[];
  at: string;
  /** Where the concern came from, in the referrer's own words. */
  source: string;
  sourceAgency: Agency;
  sourceReference?: string;
  summary: string;
  byName: string;
  byUserId?: string;
  /** MARAC only: the three people the referral is about, and the assessment behind it. */
  marac?: { victimPersonId: string; perpetratorPersonId: string; childPersonIds: string[]; riskAssessmentId?: string; repeat: boolean; previousHearingAt?: string; professionalJudgement: boolean };
  /** MAPPA only: what makes them a subject. */
  mappa?: { category: MappaDetail['category']; level: MappaDetail['level']; leadResponsibleAuthority: MappaDetail['leadResponsibleAuthority']; visorReference: string };
  /** AWI only: the decision the person may lack capacity for. */
  awi?: { decisionInQuestion: string };
  /** Child protection only, where the subject is unborn. */
  preBirth?: { expectedDeliveryDate: string; motherPersonId: string };
}

/**
 * The detail an opening records, valid against the schema and no more than the opening stage knows.
 *
 * Nothing here is invented. Where a field is required by the schema and unknown at opening, the
 * value is the honest empty one: an ASP three-point test opens as `unclear` on all three limbs with
 * the reasoning left for the person who does it, rather than as `no`, which would be an assessment
 * nobody made.
 */
export function openingDetail(input: OpeningInput): Process['detail'] {
  const { at, source, sourceAgency, sourceReference, summary, byName, byUserId } = input;

  switch (input.type) {
    case 'asp': {
      const detail: AspDetail = {
        /*
         * The workbook's own fields open as "other" and "not known" rather than as a guess. A
         * national return computed from a guessed referral source or a location of harm read off
         * the adult's address is worse than one that says the value was not recorded.
         */
        concern: { receivedAt: at, source, sourceAgency, sourceReference, summary, referralSource: 'other', harmTypes: [], locationOfHarm: 'not-known', immediateSafety: '', policeInvolved: false },
        threePointTest: {
          assessedAt: at,
          byName,
          byUserId,
          a: { met: 'unclear', reasoning: tKey('processes.open.notYetAssessed') },
          b: { met: 'unclear', reasoning: tKey('processes.open.notYetAssessed') },
          c: { met: 'unclear', reasoning: tKey('processes.open.notYetAssessed') },
          outcome: 'unclear',
        },
        ordersConsidered: [],
      };
      return detail;
    }
    case 'cp': {
      const detail: CpDetail = {
        concern: { receivedAt: at, source, sourceAgency, sourceReference, summary },
        preBirth: input.preBirth ? { expectedDeliveryDate: input.preBirth.expectedDeliveryDate, motherPersonId: input.preBirth.motherPersonId } : undefined,
      };
      return detail;
    }
    case 'marac': {
      const m = input.marac;
      if (!m) throw new Error('openingDetail: a MARAC referral needs its victim, perpetrator and risk assessment');
      const detail: MaracDetail = {
        referral: {
          receivedAt: at,
          referringAgency: sourceAgency,
          referrerName: source,
          riskAssessmentId: m.riskAssessmentId,
          professionalJudgementReferral: m.professionalJudgement,
          repeat: m.repeat,
          previousHearingAt: m.previousHearingAt,
          victimPersonId: m.victimPersonId,
          perpetratorPersonId: m.perpetratorPersonId,
          childPersonIds: m.childPersonIds,
          summary,
        },
        researchRequests: [],
        idaa: { name: '', organisation: '' },
        idaaFeedback: [],
        // Agency flags are placed after the meeting, so a new referral has none.
        flags: [],
        links: { matacConsidered: false, dsdasConsidered: false },
        safeLivesReturn: { referralSource: source, repeat: m.repeat, childrenCount: m.childPersonIds.length, outcomeCodes: [] },
      };
      return detail;
    }
    case 'mappa': {
      const p = input.mappa;
      if (!p) throw new Error('openingDetail: a MAPPA notification needs its category, level and ViSOR reference');
      const detail: MappaDetail = {
        category: p.category,
        level: p.level,
        levelHistory: [{ level: p.level, at: at.slice(0, 10), reason: summary }],
        leadResponsibleAuthority: p.leadResponsibleAuthority,
        visorReference: p.visorReference,
        victimPersonIds: [],
        notification: { at, source, byName },
        sonr: { subject: p.category === 1, compliant: true },
        custody: {},
        licenceConditions: [],
        orders: [],
        riskAssessmentIds: [],
        disclosures: [],
        preMeetingReturns: [],
        reviewSchedule: {},
      };
      return detail;
    }
    case 'awi': {
      const a = input.awi;
      const detail: AwiDetail = {
        concern: { raisedAt: at, source, sourceAgency, decisionInQuestion: a?.decisionInQuestion ?? tKey('processes.open.decisionNotStated'), summary },
        capacityAssessments: [],
        orders: [],
        supervisionVisits: [],
        investigations: [],
      };
      return detail;
    }
  }
}

export interface ProcessShell {
  id: string;
  reference: string;
  title: string;
  subjectIds: string[];
  leadAgency: Agency;
  leadUserId: string;
  stage: Stage;
  stageHistory: Process['stageHistory'];
  classification: Classification;
  accessRestriction: Process['accessRestriction'];
  members: Process['members'];
  clocks: Process['clocks'];
  openedAt: string;
}

/**
 * The new process, discriminated properly.
 *
 * A spread with a computed `type` and a computed `detail` does not satisfy the union: TypeScript
 * cannot see that the two agree, and a cast would be a claim nobody checked. Switching on the type
 * once, here, is four extra lines and means the compiler proves the pairing rather than being told.
 */
export function buildOpeningProcess(shell: ProcessShell, input: OpeningInput): Process {
  const base = {
    ...shell,
    synthetic: true as const,
    status: 'open' as const,
    flags: {},
    parties: [],
    // Empty rather than absent: a new case links to nothing yet, and the screens read these arrays.
    linkedProcessIds: [],
    viewsRecordIds: [],
    riskAssessmentIds: [],
  };
  const detail = openingDetail(input);
  switch (input.type) {
    case 'asp':
      return { ...base, type: 'asp', detail: detail as AspDetail };
    case 'cp':
      return { ...base, type: 'cp', detail: detail as CpDetail };
    case 'marac':
      return { ...base, type: 'marac', detail: detail as MaracDetail };
    case 'mappa':
      return { ...base, type: 'mappa', detail: detail as MappaDetail };
    case 'awi':
      return { ...base, type: 'awi', detail: detail as AwiDetail };
  }
}
