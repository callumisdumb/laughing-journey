/**
 * Bulk background population: households, people, relationships and single-agency chronology events.
 * These are the people who make lists and search feel real. Scenarios sit on top.
 */
import type { Agency, EventType, Person, Significance } from '@mas/domain';
import { addDays, addYears, differenceInYears, formatISO, parseISO, subDays, subYears } from 'date-fns';
import type { BuildContext } from './context';
import { at, makeAddress, makeEvent, makeHousehold, makePerson, relate, syntheticChi } from './factory';
import { HOSPITAL, TOWNS, postcode } from './geography';
import { NAME_POOLS, STAFF_FAMILY, STAFF_GIVEN } from './names';

type HouseholdKind = 'older-single' | 'older-couple' | 'family' | 'lone-parent' | 'single-adult' | 'couple';

function isoDate(d: Date): string {
  return formatISO(d, { representation: 'date' });
}

function pickPool(ctx: BuildContext) {
  const total = NAME_POOLS.reduce((s, p) => s + p.weight, 0);
  let r = ctx.rng.next() * total;
  for (const p of NAME_POOLS) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return NAME_POOLS[0]!;
}

function randomDob(ctx: BuildContext, minAge: number, maxAge: number): string {
  const age = ctx.rng.int(minAge, maxAge);
  const d = subDays(subYears(ctx.now, age), ctx.rng.int(0, 364));
  return isoDate(d);
}

function staffName(ctx: BuildContext): string {
  return `${ctx.rng.pick(STAFF_GIVEN)} ${ctx.rng.pick(STAFF_FAMILY)}`;
}

function schoolFor(townName: string, dob: string, ctx: BuildContext): string | undefined {
  const age = differenceInYears(ctx.now, parseISO(dob));
  const town = TOWNS.find((t) => t.name === townName) ?? TOWNS[0]!;
  if (age < 5) return undefined;
  if (age <= 11) return town.primarySchool;
  if (age <= 17) return town.secondarySchool;
  return undefined;
}

export interface BulkStats {
  households: number;
  people: number;
  events: number;
}

export function seedBulkPopulation(ctx: BuildContext, householdCount: number): BulkStats {
  const kinds: HouseholdKind[] = ['older-single', 'older-single', 'older-couple', 'family', 'family', 'family', 'family', 'lone-parent', 'lone-parent', 'single-adult', 'single-adult', 'couple'];
  let events = 0;
  let people = 0;

  for (let h = 0; h < householdCount; h += 1) {
    const kind = ctx.rng.pick(kinds);
    const town = ctx.rng.pick(TOWNS);
    const addr = makeAddress(ctx, {
      line1: `${ctx.rng.int(1, 120)} ${ctx.rng.pick(town.streets)}`,
      town: town.name,
      postcode: postcode(town.postcodeArea, () => ctx.rng.next()),
    });
    const hhId = ctx.ids.next('hh');
    const pool = pickPool(ctx);
    const family = ctx.rng.pick(pool.family);
    const movedIn = isoDate(subDays(ctx.now, ctx.rng.int(200, 4000)));
    const members: Person[] = [];

    const addAdult = (sex: 'female' | 'male', minAge: number, maxAge: number, familyName = family): Person => {
      const dob = randomDob(ctx, minAge, maxAge);
      const given = ctx.rng.pick(sex === 'female' ? pool.female : pool.male);
      const interpreter = pool.languages.length > 0 && ctx.rng.chance(0.4) ? ctx.rng.pick(pool.languages) : undefined;
      const p = makePerson(ctx, {
        givenName: given,
        familyName,
        sex,
        lifeStage: 'adult',
        dateOfBirth: dob,
        chi: syntheticChi(ctx, dob, sex),
        addressHistory: [{ addressId: addr.id, from: movedIn }],
        householdId: hhId,
        gpPractice: town.gpPractice,
        communicationNeeds: interpreter ? { interpreterLanguage: interpreter, needs: [`${interpreter} interpreter for meetings`] } : { needs: [] },
      });
      members.push(p);
      return p;
    };
    /*
     * `minAge` exists for one reason: the 16 and 17 year old.
     *
     * A person of that age is eligible for adult support and protection and for child protection at
     * the same time, and the ASP national minimum dataset keeps a distinct age category so it can be
     * known which route they took. It is the most interesting eligibility case the product has, and
     * a uniform draw over 0 to 17 across 58 households happened to produce none at all, so the
     * demonstration could not show it. Every fourth family household now has one deliberately
     * (D-138).
     */
    const addChild = (parent: Person, familyName: string, minAge = 0): Person => {
      const parentAge = differenceInYears(ctx.now, parseISO(parent.dateOfBirth ?? '1980-01-01'));
      const maxAge = Math.min(17, parentAge - 18);
      if (maxAge < minAge) return parent;
      const sex = ctx.rng.chance(0.5) ? 'female' : 'male';
      const dob = randomDob(ctx, minAge, maxAge);
      const p = makePerson(ctx, {
        givenName: ctx.rng.pick(sex === 'female' ? pool.female : pool.male),
        familyName,
        sex,
        lifeStage: 'child',
        dateOfBirth: dob,
        chi: syntheticChi(ctx, dob, sex),
        addressHistory: [{ addressId: addr.id, from: movedIn < dob ? dob : movedIn }],
        householdId: hhId,
        gpPractice: town.gpPractice,
        school: schoolFor(town.name, dob, ctx),
      });
      relate(ctx, parent.id, p.id, parent.sex === 'female' ? 'mother-of' : 'father-of');
      members.push(p);
      return p;
    };

    switch (kind) {
      case 'older-single':
        addAdult(ctx.rng.chance(0.65) ? 'female' : 'male', 70, 92);
        break;
      case 'older-couple': {
        const a = addAdult('female', 68, 88);
        const b = addAdult('male', 68, 90);
        relate(ctx, a.id, b.id, 'partner-of');
        break;
      }
      case 'family': {
        // The parents are old enough for a 16 or 17 year old where one is wanted, so the floor is
        // reachable rather than silently dropped by the `maxAge < minAge` guard.
        const wantsYoungAdult = h % 4 === 0;
        const mother = addAdult('female', wantsYoungAdult ? 34 : 24, 48);
        const father = addAdult('male', 25, 52);
        relate(ctx, mother.id, father.id, 'partner-of');
        const n = ctx.rng.int(1, 3);
        const kids: Person[] = [];
        for (let i = 0; i < n; i += 1) {
          const c = addChild(mother, family, wantsYoungAdult && i === 0 ? 16 : 0);
          if (c !== mother) {
            relate(ctx, father.id, c.id, 'father-of');
            kids.push(c);
          }
        }
        for (let i = 0; i < kids.length; i += 1) for (let j = i + 1; j < kids.length; j += 1) relate(ctx, kids[i]!.id, kids[j]!.id, 'sibling-of');
        break;
      }
      case 'lone-parent': {
        const parent = addAdult(ctx.rng.chance(0.85) ? 'female' : 'male', 20, 45);
        const n = ctx.rng.int(1, 3);
        for (let i = 0; i < n; i += 1) addChild(parent, family);
        break;
      }
      case 'single-adult':
        addAdult(ctx.rng.chance(0.5) ? 'female' : 'male', 19, 66);
        break;
      case 'couple': {
        const a = addAdult('female', 22, 60);
        const b = addAdult('male', 22, 62, ctx.rng.pick(pool.family));
        relate(ctx, a.id, b.id, 'partner-of');
        break;
      }
    }

    makeHousehold(ctx, { id: hhId, addressId: addr.id, from: movedIn, memberIds: members.map((m) => m.id), label: `${family} household, ${town.name}` });
    people += members.length;

    // Background events per member.
    const householdPoliceHistory = ctx.rng.chance(0.22);
    const householdSocialWork = ctx.rng.chance(0.18);
    for (const m of members) {
      events += seedPersonEvents(ctx, m, town.gpPractice, { householdPoliceHistory, householdSocialWork, householdMembers: members });
    }
  }
  return { households: householdCount, people, events };
}

interface EventContext {
  householdPoliceHistory: boolean;
  householdSocialWork: boolean;
  householdMembers: Person[];
}

function push(ctx: BuildContext, e: { subject: Person; date: Date; agency: Agency; source: 'manual' | 'emis-web' | 'trakcare' | 'morse' | 'seemis' | 'ivpd' | 'eclipse'; type: EventType; title: string; detail: string; response?: string; outcome?: string; significance?: Significance; time?: string; linked?: string[] }): void {
  const d = isoDate(e.date);
  makeEvent(ctx, {
    subjectIds: [e.subject.id],
    occurredAt: e.time ? at(d, e.time) : at(d, '00:00'),
    hasTime: Boolean(e.time),
    agency: e.agency,
    sourceSystem: e.source,
    recordedByName: e.source === 'manual' ? staffName(ctx) : `${e.source} connector`,
    eventType: e.type,
    title: e.title,
    detail: e.detail,
    response: e.response,
    outcome: e.outcome,
    significance: e.significance ?? 'low',
    linkedPersonIds: e.linked ?? [],
    visibility: 'agency-only',
  });
}

function seedPersonEvents(ctx: BuildContext, p: Person, gp: string, ec: EventContext): number {
  const before = ctx.data.events.length;
  const dob = parseISO(p.dateOfBirth ?? '1970-01-01');
  const age = differenceInYears(ctx.now, dob);
  const others = ec.householdMembers.filter((m) => m.id !== p.id).map((m) => m.id);

  if (age <= 17) {
    push(ctx, { subject: p, date: dob, agency: 'health', source: 'trakcare', type: 'family.birth', title: `Born at ${HOSPITAL}`, detail: `Birth registered. Weight ${(2.6 + ctx.rng.next() * 1.6).toFixed(2)} kg.`, significance: 'low' });
    const hvReviews = [10, 42, 100, 400, 800, 1600];
    for (const day of hvReviews) {
      const d = addDays(dob, day);
      if (d > ctx.now) break;
      if (ctx.rng.chance(0.12)) push(ctx, { subject: p, date: d, agency: 'health', source: 'morse', type: 'health.missed-appointment', title: 'Health visitor review not attended', detail: 'Appointment offered; not at home. Letter sent.', response: 'Rebooked within two weeks.', significance: 'moderate' });
      else push(ctx, { subject: p, date: d, agency: 'health', source: 'morse', type: 'health.assessment', title: 'Health visitor review', detail: 'Developmental review completed. No concerns recorded.', significance: 'low' });
    }
    if (age >= 5) {
      const p1 = new Date(dob.getFullYear() + 5, 7, 17);
      if (p1 > dob && p1 < ctx.now) push(ctx, { subject: p, date: p1, agency: 'education', source: 'seemis', type: 'education.enrolment', title: `Enrolled in P1 at ${p.school ?? 'primary school'}`, detail: 'Enrolment recorded in SEEMIS.', significance: 'low' });
      for (let y = dob.getFullYear() + 6; y <= ctx.now.getFullYear(); y += 1) {
        const end = new Date(y, 5, 26);
        if (end > ctx.now) break;
        const pct = ctx.rng.int(86, 99);
        push(ctx, { subject: p, date: end, agency: 'education', source: 'seemis', type: 'education.attendance', title: `Attendance ${pct} percent for the session`, detail: `Session ${y - 1} to ${y}. ${pct < 90 ? 'Below the 90 percent threshold.' : 'Within expected range.'}`, significance: pct < 90 ? 'moderate' : 'low' });
      }
      if (ctx.rng.chance(0.15)) push(ctx, { subject: p, date: subDays(ctx.now, ctx.rng.int(30, 700)), agency: 'education', source: 'manual', type: 'education.concern', title: 'Wellbeing concern noted by class teacher', detail: 'Child appeared tired and hungry on several mornings.', response: 'Named person spoke with parent.', outcome: 'Breakfast club place offered.', significance: 'moderate' });
    }
  } else {
    if (ctx.rng.chance(0.5)) push(ctx, { subject: p, date: subDays(ctx.now, ctx.rng.int(20, 900)), agency: 'health', source: 'emis-web', type: 'health.consultation', title: 'GP consultation', detail: `Routine consultation at ${gp}.`, significance: 'low' });
    if (age >= 68) {
      if (ctx.rng.chance(0.45)) push(ctx, { subject: p, date: subDays(ctx.now, ctx.rng.int(30, 600)), agency: 'health', source: 'trakcare', type: 'health.admission', title: `Admitted to ${HOSPITAL} after a fall`, detail: 'Fall at home. No fracture. Admitted for observation.', response: 'Occupational therapy assessment before discharge.', outcome: 'Discharged home with equipment.', significance: 'moderate', time: `${String(ctx.rng.int(8, 22)).padStart(2, '0')}:${ctx.rng.pick(['05', '20', '40'])}` });
      if (ctx.rng.chance(0.35)) push(ctx, { subject: p, date: subDays(ctx.now, ctx.rng.int(60, 1500)), agency: 'social-work', source: 'eclipse', type: 'care.service-start', title: 'Care at home service started', detail: 'Two visits a day for personal care.', significance: 'moderate' });
      if (ctx.rng.chance(0.25)) push(ctx, { subject: p, date: subDays(ctx.now, ctx.rng.int(200, 2500)), agency: 'regulator', source: 'manual', type: 'legal.poa-registered', title: 'Power of attorney registered with OPG', detail: 'Combined welfare and financial power of attorney registered.', significance: 'moderate' });
    } else if (ctx.rng.chance(0.2)) {
      push(ctx, { subject: p, date: subDays(ctx.now, ctx.rng.int(20, 800)), agency: 'health', source: 'trakcare', type: 'health.attendance', title: 'Emergency department attendance', detail: ctx.rng.pick(['Laceration to hand, sutured.', 'Alcohol intoxication, observed and discharged.', 'Chest pain, investigations normal.', 'Minor road traffic collision, discharged.']), significance: 'low', time: `${String(ctx.rng.int(0, 23)).padStart(2, '0')}:${ctx.rng.pick(['10', '35', '50'])}` });
    }
    if (ctx.rng.chance(0.3)) {
      const moveDate = subDays(ctx.now, ctx.rng.int(400, 3000));
      push(ctx, { subject: p, date: moveDate, agency: 'housing', source: 'manual', type: 'move.address', title: 'Moved to current address', detail: 'Tenancy started.', significance: 'low' });
    }
  }

  if (ec.householdPoliceHistory && age >= 16) {
    const n = ctx.rng.int(1, 3);
    for (let i = 0; i < n; i += 1) {
      push(ctx, { subject: p, date: subDays(ctx.now, ctx.rng.int(30, 1200)), agency: 'police', source: 'ivpd', type: 'police.concern-report', title: ctx.rng.pick(['Adult concern report: disturbance at home address', 'Adult concern report: welfare check', 'Domestic incident, no crime recorded']), detail: 'Officers attended following a call from a neighbour. No injuries. Concern report submitted.', response: 'Shared with the concern hub for triage.', significance: 'moderate', time: `${ctx.rng.int(18, 23)}:${ctx.rng.pick(['15', '40', '55'])}`, linked: others });
    }
  }
  if (ec.householdPoliceHistory && age < 16 && ctx.rng.chance(0.6)) {
    push(ctx, { subject: p, date: subDays(ctx.now, ctx.rng.int(30, 1200)), agency: 'police', source: 'ivpd', type: 'police.concern-report', title: 'Child concern report: child present at domestic incident', detail: 'Child present when officers attended. No injuries to the child.', response: 'Shared with social work duty.', significance: 'high', time: `${ctx.rng.int(18, 23)}:${ctx.rng.pick(['05', '30', '45'])}`, linked: others });
  }
  if (ec.householdSocialWork && ctx.rng.chance(0.7)) {
    const d = subDays(ctx.now, ctx.rng.int(60, 1500));
    push(ctx, { subject: p, date: d, agency: 'social-work', source: 'eclipse', type: 'social-work.referral', title: 'Referral received', detail: age < 18 ? 'Referral from school about wellbeing.' : 'Referral from GP for a community care assessment.', significance: 'moderate' });
    push(ctx, { subject: p, date: addDays(d, ctx.rng.int(5, 30)), agency: 'social-work', source: 'eclipse', type: 'social-work.assessment', title: 'Assessment completed', detail: 'Assessment completed and outcome shared with the family.', outcome: ctx.rng.pick(['No further action.', 'Support plan agreed.', 'Signposted to community services.']), significance: 'low' });
  }
  return ctx.data.events.length - before;
}

/** A person's age in years at a date, exported for scenarios. */
export function ageOn(dateOfBirth: string, on: Date): number {
  return differenceInYears(on, parseISO(dateOfBirth));
}

export { addYears };
