/**
 * Pure selectors over the dataset. No React here.
 */
import {
  AGENCY_SHORT,
  accessFor,
  computeClock,
  findClockRule,
  sortByUrgency,
  type Action,
  type Agency,
  type ChronologyEvent,
  type ClockResult,
  type Config,
  type Dataset,
  type Meeting,
  type Membership,
  type Person,
  type Process,
  type User,
  type AccessResult,
} from '@mas/domain';
import type { BreakGlassGrant } from './store';

export function fullName(p: Pick<Person, 'givenName' | 'familyName' | 'preferredName'>): string {
  return `${p.givenName} ${p.familyName}`;
}

export function userName(u: Pick<User, 'givenName' | 'familyName'>): string {
  return `${u.givenName} ${u.familyName}`;
}

export function personById(data: Dataset, id: string | undefined): Person | undefined {
  return id ? data.people.find((p) => p.id === id) : undefined;
}

export function userById(data: Dataset, id: string | undefined): User | undefined {
  return id ? data.users.find((u) => u.id === id) : undefined;
}

export function processById(data: Dataset, id: string | undefined): Process | undefined {
  return id ? data.processes.find((p) => p.id === id) : undefined;
}

export function meetingById(data: Dataset, id: string | undefined): Meeting | undefined {
  return id ? data.meetings.find((m) => m.id === id) : undefined;
}

export function processesForPerson(data: Dataset, personId: string): Process[] {
  return data.processes.filter((p) => p.subjectIds.includes(personId));
}

/** Processes where the person appears in any role (subject, victim, perpetrator, linked). */
export function processesInvolving(data: Dataset, personId: string): Process[] {
  return data.processes.filter((p) => {
    if (p.subjectIds.includes(personId)) return true;
    if (p.type === 'marac') return p.detail.referral.perpetratorPersonId === personId || p.detail.referral.childPersonIds.includes(personId) || p.detail.referral.victimPersonId === personId;
    if (p.type === 'cp' && p.detail.preBirth?.motherPersonId === personId) return true;
    return false;
  });
}

export function eventsForPerson(data: Dataset, personId: string): ChronologyEvent[] {
  return data.events.filter((e) => e.subjectIds.includes(personId)).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
}

export function clocksForProcess(data: Dataset, config: Config, process: Process, now: Date): ClockResult[] {
  const out: ClockResult[] = [];
  for (const t of process.clocks) {
    const rule = findClockRule(config.clockRules, t.ruleId);
    if (!rule) continue;
    out.push(computeClock(t, rule, now, { bankHolidays: config.bankHolidays, councilHolidays: config.councilHolidays }));
  }
  return sortByUrgency(out);
}

export interface UserClock extends ClockResult {
  process: Process;
  subjectName: string;
}

export function clocksForUser(data: Dataset, config: Config, user: User, now: Date): UserClock[] {
  const out: UserClock[] = [];
  for (const p of data.processes) {
    if (p.status !== 'open') continue;
    if (!user.caseMemberships.includes(p.id) && !isOversight(user)) continue;
    const subject = personById(data, p.subjectIds[0]);
    for (const c of clocksForProcess(data, config, p, now)) {
      if (c.status === 'complete') continue;
      out.push({ ...c, process: p, subjectName: subject ? fullName(subject) : p.title });
    }
  }
  return sortByUrgency(out) as UserClock[];
}

export function isOversight(user: User): boolean {
  return ['cswo', 'apc-lead-officer', 'cpc-lead-officer', 'inspector'].includes(user.roleId);
}

export function actionsForUser(data: Dataset, user: User): Action[] {
  return data.actions.filter((a) => a.ownerUserId === user.id && a.status !== 'complete' && a.status !== 'cancelled').sort((a, b) => (a.due < b.due ? -1 : 1));
}

export function meetingsForUser(data: Dataset, user: User): Meeting[] {
  return data.meetings.filter((m) => m.status !== 'cancelled' && (m.chairUserId === user.id || m.minuteTakerUserId === user.id || m.invitees.some((i) => i.userId === user.id))).sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1));
}

export function accessForUser(data: Dataset, config: Config, user: User, process: Process, grants: BreakGlassGrant[], now: Date): AccessResult {
  const active = grants.filter((g) => g.processId === process.id && g.expiresAt > now.toISOString()).map((g) => g.processId);
  return accessFor(user, process, { rows: config.needToKnow, activeBreakGlass: active });
}

export interface InvolvedPerson {
  membership: Membership;
  user: User | undefined;
}

export function membersByAgency(data: Dataset, process: Process): Array<{ agency: Agency; label: string; members: InvolvedPerson[] }> {
  const groups = new Map<Agency, InvolvedPerson[]>();
  for (const m of process.members) {
    const list = groups.get(m.agency) ?? [];
    list.push({ membership: m, user: userById(data, m.userId) });
    groups.set(m.agency, list);
  }
  return [...groups.entries()].map(([agency, members]) => ({ agency, label: AGENCY_SHORT[agency], members }));
}

export function currentAddress(data: Dataset, person: Person): { line: string; moves: number } {
  const sorted = [...person.addressHistory].sort((a, b) => (a.from < b.from ? 1 : -1));
  const current = sorted.find((a) => !a.to) ?? sorted[0];
  const addr = current ? data.addresses.find((a) => a.id === current.addressId) : undefined;
  const line = addr ? [addr.line1, addr.line2, addr.town, addr.postcode].filter(Boolean).join(', ') : 'No address recorded';
  return { line, moves: Math.max(0, person.addressHistory.length - 1) };
}

export function inboxForUser(data: Dataset, user: User) {
  return data.connectorEvents.filter((c) => c.status === 'pending' && (c.agency === user.agency || user.roleId === 'system-administrator'));
}

export function unreadSharesForUser(data: Dataset, user: User) {
  return data.sharingRecords.filter((s) => s.recipient.userId === user.id && s.status !== 'read' && s.status !== 'withheld');
}

export function preMeetingRequestsForUser(data: Dataset, user: User) {
  const out: Array<{ meeting: Meeting; request: Meeting['preMeetingRequests'][number] }> = [];
  for (const m of data.meetings) {
    if (m.status === 'cancelled' || m.status === 'held') continue;
    for (const r of m.preMeetingRequests) {
      if (r.toUserId === user.id && (r.status === 'sent' || r.status === 'overdue')) out.push({ meeting: m, request: r });
    }
  }
  return out;
}

export function researchRequestsForUser(data: Dataset, user: User) {
  const out: Array<{ process: Process; request: { id: string; agency: Agency; dueAt: string; status: string; sentAt: string } }> = [];
  for (const p of data.processes) {
    if (p.type !== 'marac') continue;
    for (const r of p.detail.researchRequests) {
      if ((r.toUserId === user.id || (!r.toUserId && r.agency === user.agency)) && (r.status === 'sent' || r.status === 'overdue')) out.push({ process: p, request: r });
    }
  }
  return out;
}
