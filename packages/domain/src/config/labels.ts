/**
 * Display labels for the stages of each process and for enum values whose lists live in the
 * schemas rather than in enums.ts. Every function reads the message catalogue at call time, so an
 * Admin override applies everywhere at once; the identifiers stay as they are in the data.
 */
import { hasMessage, tKey } from '@mas/messages';
import { keySegment, type ProcessType } from '../enums';
import type { Plan } from '../schemas/action-plan';
import type { ChronologyAnalysis } from '../schemas/chronology';
import type { EvidenceRef } from '../schemas/common';
import type { Invitee, Meeting } from '../schemas/meeting';
import type { AspDetail, AwiDetail, CpDetail, MappaDetail, Process } from '../schemas/process';
import type { SharingRecord } from '../schemas/sharing';

/* ---------- Stages ---------- */

/** Stage name for a process, or the stage id itself when the catalogue has no entry for it. */
export function stageLabel(process: ProcessType, stage: string): string {
  const key = `domain.stages.${process}.${keySegment(stage)}`;
  return hasMessage(key) ? tKey(key) : stage;
}



/* ---------- Meetings ---------- */

export function meetingStatusLabel(status: Meeting['status']): string {
  return tKey(`domain.meetingStatuses.${keySegment(status)}`);
}

export function minuteStatusLabel(status: Meeting['minute']['status']): string {
  return tKey(`domain.minuteStatuses.${keySegment(status)}`);
}

export function attendanceLabel(attendance: Invitee['attendance']): string {
  return tKey(`domain.attendances.${keySegment(attendance)}`);
}

export function packItemKindLabel(kind: Meeting['pack'][number]['kind']): string {
  return tKey(`domain.packItemKinds.${keySegment(kind)}`);
}

/** Status of a pre-meeting request (the MARAC research request shares its statuses) or a MAPPA pre-meeting return. */
export type ResearchStatus = Meeting['preMeetingRequests'][number]['status'] | MappaDetail['preMeetingReturns'][number]['status'];

export function researchStatusLabel(status: ResearchStatus): string {
  return tKey(`domain.researchStatuses.${keySegment(status)}`);
}

/* ---------- Processes, plans, sharing and chronology ---------- */

export function processStatusLabel(status: Process['status']): string {
  return tKey(`domain.processStatuses.${keySegment(status)}`);
}

export function planStatusLabel(status: Plan['status']): string {
  return tKey(`domain.planStatuses.${keySegment(status)}`);
}

export function shareStatusLabel(status: SharingRecord['status']): string {
  return tKey(`domain.shareStatuses.${keySegment(status)}`);
}

export function analysisKindLabel(kind: ChronologyAnalysis['kind']): string {
  return tKey(`domain.analysisKinds.${keySegment(kind)}`);
}

export function evidenceKindLabel(kind: EvidenceRef['kind']): string {
  return tKey(`domain.evidenceKinds.${keySegment(kind)}`);
}

/* ---------- Child protection ---------- */

export function cppmDecisionLabel(decision: NonNullable<CpDetail['cppm']>['decision']): string {
  return tKey(`domain.cppmDecisions.${keySegment(decision)}`);
}

export function irdMedicalKindLabel(kind: NonNullable<NonNullable<CpDetail['ird']>['decisions']['medical']['kind']>): string {
  return tKey(`domain.irdMedicalKinds.${keySegment(kind)}`);
}

/* ---------- Adult support and protection ---------- */

export function aspScreeningOutcomeLabel(outcome: NonNullable<AspDetail['screening']>['outcome']): string {
  return tKey(`domain.aspScreeningOutcomes.${keySegment(outcome)}`);
}

export function aspInquiryOutcomeLabel(outcome: NonNullable<AspDetail['inquiry']>['outcome']): string {
  return tKey(`domain.aspInquiryOutcomes.${keySegment(outcome)}`);
}

export function aspOrderLabel(order: AspDetail['ordersConsidered'][number]['order']): string {
  return tKey(`domain.aspOrders.${keySegment(order)}`);
}

export function aspOrderDecisionLabel(decision: AspDetail['ordersConsidered'][number]['decision']): string {
  return tKey(`domain.aspOrderDecisions.${keySegment(decision)}`);
}

export function lsiStrandStatusLabel(status: NonNullable<AspDetail['lsi']>['strands'][number]['status']): string {
  return tKey(`domain.lsiStrandStatuses.${keySegment(status)}`);
}

/** Status of a records request (ASP s10), a medical report or a suitability report. */
export type RequestStatus = NonNullable<AspDetail['investigation']>['recordsRequests'][number]['status'] | NonNullable<AwiDetail['application']>['medicalReports'][number]['status'] | NonNullable<NonNullable<AwiDetail['application']>['suitabilityReport']['status']>;

export function requestStatusLabel(status: RequestStatus): string {
  return tKey(`domain.requestStatuses.${keySegment(status)}`);
}

/* ---------- MAPPA ---------- */

export function eraStatusLabel(status: NonNullable<MappaDetail['era']>['status']): string {
  return tKey(`domain.eraStatuses.${keySegment(status)}`);
}

export function mappaExitKindLabel(kind: NonNullable<MappaDetail['exit']>['kind']): string {
  return tKey(`domain.mappaExitKinds.${keySegment(kind)}`);
}

export function disclosureStatusLabel(status: MappaDetail['disclosures'][number]['status']): string {
  return tKey(`domain.disclosureStatuses.${keySegment(status)}`);
}

export function licenceConditionStatusLabel(status: MappaDetail['licenceConditions'][number]['status']): string {
  return tKey(`domain.licenceConditionStatuses.${keySegment(status)}`);
}

/* ---------- Adults with incapacity ---------- */

export function capacityOutcomeLabel(outcome: AwiDetail['capacityAssessments'][number]['outcome']): string {
  return tKey(`domain.capacityOutcomes.${keySegment(outcome)}`);
}

export function mhoReportStatusLabel(status: NonNullable<AwiDetail['application']>['mhoReport']['status']): string {
  return tKey(`domain.mhoReportStatuses.${keySegment(status)}`);
}

export function medicalReportKindLabel(kind: NonNullable<AwiDetail['application']>['medicalReports'][number]['kind']): string {
  return tKey(`domain.medicalReportKinds.${keySegment(kind)}`);
}

export function awiOrderKindLabel(kind: AwiDetail['orders'][number]['kind']): string {
  return tKey(`domain.awiOrderKinds.${keySegment(kind)}`);
}

export function poaKindLabel(kind: NonNullable<NonNullable<AwiDetail['opgResult']>['powerOfAttorney']['kind']>): string {
  return tKey(`domain.poaKinds.${keySegment(kind)}`);
}
