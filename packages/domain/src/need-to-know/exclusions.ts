import type { Exclusion } from '../schemas/config';

/** Hard exclusions. None of these can be lifted in the UI except where liftableBy is set. */
export const EXCLUSIONS: Exclusion[] = [
  { id: 'asp.conference.alleged-perpetrator', process: 'asp', stage: 'case-conference', party: 'alleged-perpetrator', label: 'Alleged perpetrator', reason: 'Not invited unless a household member with a right to be heard', liftableBy: "Chair's recorded decision" },
  { id: 'cp.ird.parents-if-risk', process: 'cp', stage: 'ird', party: 'parents-if-risk', label: 'Parents and carers', reason: 'Where sharing would jeopardise a criminal investigation or increase risk to the child; decision recorded', liftableBy: 'IRD decision on information sharing with parents' },
  { id: 'marac.all.perpetrator', process: 'marac', stage: '*', party: 'perpetrator', label: 'Perpetrator', reason: 'The perpetrator is never told about MARAC' },
  { id: 'marac.all.associates', process: 'marac', stage: '*', party: 'perpetrator-associates', label: "Perpetrator's family or associates", reason: 'Would increase risk to the victim' },
  { id: 'mappa.all.victims', process: 'mappa', stage: '*', party: 'victim', label: 'Victims', reason: 'MAPPA information is not given to victims; the Victim Notification Scheme is a separate route' },
  { id: 'mappa.all.employers', process: 'mappa', stage: '*', party: 'employer', label: 'Employers', reason: 'Only specific facts via a recorded disclosure decision' },
  { id: 'mappa.all.public', process: 'mappa', stage: '*', party: 'public', label: 'Public', reason: 'No public disclosure' },
  { id: 'mappa.meeting.not-on-distribution', process: 'mappa', stage: 'meeting', party: 'not-on-distribution', label: 'Anyone not on the distribution list', reason: 'Restricted minute' },
  { id: 'mappa.managed.not-on-distribution', process: 'mappa', stage: 'managed', party: 'not-on-distribution', label: 'Anyone not on the distribution list', reason: 'Restricted minute' },
];
