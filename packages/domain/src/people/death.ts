import { processLabel, type ProcessType } from '../enums';
import { processSubjectIds } from '../processes/eligibility';
import { closeProcess, closureReasonsFor, type CloseInput } from '../processes/close';
import { partyRegister } from '../need-to-know/parties';
import type { Dataset } from '../schemas/dataset';
import type { Person } from '../schemas/person';
import type { Process } from '../schemas/process';

/**
 * Recording a death, which is not a tick box.
 *
 * It closes or changes every open process the person is a subject of, and the closure reason differs
 * by process because the national returns differ: an ASP case takes "Meets three-point criteria, no
 * opportunity for further ASP intervention", which is the workbook's own row for a death during the
 * process; a child protection case takes "Child died" from the de-registration list; a MAPPA case
 * exits by de-registration. It writes a chronology event and notifies every case member, both of
 * which the write pipeline does.
 *
 * What it does not do is close a case the person was merely a party to. A father dying does not
 * close his child's child protection case; it changes it, sometimes profoundly, and the case needs a
 * person to look at it rather than a system to shut it. Those come back as `review`.
 */

export type DeathEffect = 'close' | 'review';

export interface DeathConsequence {
  processId: string;
  reference: string;
  type: ProcessType;
  typeLabel: string;
  effect: DeathEffect;
  /** Where the case closes: the reason id from that process's own closure list. */
  reasonId?: string;
  reasonLabel?: string;
  /** Why this case is affected. A subject's death closes it; a party's death is for somebody to read. */
  because: 'subject' | 'party';
}

/**
 * The closure reason each process type takes when its subject dies.
 *
 * Named ids from the lists in `close.ts` rather than free text, because the quarterly figure is
 * counted from the coded value and a death recorded as prose is a death nobody counts. MARAC and AWI
 * take the local list's own `person-died`, which is marked local in the interface.
 */
export const DEATH_CLOSURE_REASON: Record<ProcessType, string> = {
  asp: 'criteria-no-opportunity',
  cp: 'child-died',
  mappa: 'deregistration',
  marac: 'person-died',
  awi: 'person-died',
};

/** Everybody a process is about, plus everybody the case-role register names. */
function touches(process: Process, personId: string, relationships: Dataset['relationships']): 'subject' | 'party' | null {
  if (processSubjectIds(process).includes(personId)) return 'subject';
  if (partyRegister(process, relationships).some((party) => party.personId === personId)) return 'party';
  return null;
}

/**
 * What recording this death will do, computed before it is recorded so the dialog can show it.
 *
 * The same function produces the list on screen and drives the write, so the practitioner is shown
 * what will happen rather than a description somebody wrote next to a form.
 */
export function deathConsequences(data: Dataset, personId: string): DeathConsequence[] {
  const out: DeathConsequence[] = [];
  for (const process of data.processes) {
    if (process.status !== 'open') continue;
    const how = touches(process, personId, data.relationships);
    if (!how) continue;
    if (how === 'party') {
      out.push({ processId: process.id, reference: process.reference, type: process.type, typeLabel: processLabel(process.type), effect: 'review', because: 'party' });
      continue;
    }
    const reasonId = DEATH_CLOSURE_REASON[process.type];
    const reason = closureReasonsFor(process.type).find((r) => r.id === reasonId);
    out.push({
      processId: process.id,
      reference: process.reference,
      type: process.type,
      typeLabel: processLabel(process.type),
      effect: 'close',
      reasonId,
      reasonLabel: reason?.label,
      because: 'subject',
    });
  }
  return out;
}

export interface DeathInput {
  personId: string;
  /** The date of death, which is a calendar date and not the moment it was recorded. */
  at: string;
  recordedAt: string;
  byUserId?: string;
  byName: string;
  source?: string;
  /** The sentence that goes on every closure, so the closed cases say the same thing. */
  note: string;
}

export function deathRefusals(person: Person | undefined, input: DeathInput, today: string): string[] {
  const errors: string[] = [];
  if (!person) errors.push('personMissing');
  if (person?.death) errors.push('deathAlreadyRecorded');
  if (input.at > today) errors.push('deathInFuture');
  if (person?.dateOfBirth && input.at < person.dateOfBirth) errors.push('deathBeforeBirth');
  if (input.note.trim().length < 10) errors.push('deathNoteRequired');
  return errors;
}

export interface DeathResult {
  person: Person;
  /** The processes as they now are, only the ones that changed. */
  processes: Process[];
  consequences: DeathConsequence[];
}

/**
 * The person marked as died and every case of theirs closed, with the right reason on each.
 *
 * Returns the changed records rather than a whole dataset, so the caller writes each one through the
 * pipeline and each one gets its own audit entry, its own chronology entry and its own notifications.
 * A death that produced one audit entry covering four case closures would be a death nobody could
 * trace through the cases it closed.
 */
export function applyDeath(data: Dataset, input: DeathInput): DeathResult {
  const person = data.people.find((p) => p.id === input.personId)!;
  const consequences = deathConsequences(data, input.personId);
  const processes: Process[] = [];
  for (const consequence of consequences) {
    if (consequence.effect !== 'close' || !consequence.reasonId) continue;
    const process = data.processes.find((p) => p.id === consequence.processId)!;
    const close: CloseInput = { reasonId: consequence.reasonId, note: input.note.trim(), at: input.recordedAt, byUserId: input.byUserId, byName: input.byName };
    processes.push(closeProcess(process, close).process);
  }
  return {
    consequences,
    processes,
    person: {
      ...person,
      deceased: true,
      death: { at: input.at, recordedAt: input.recordedAt, byUserId: input.byUserId, byName: input.byName, source: input.source?.trim() || undefined },
    },
  };
}
