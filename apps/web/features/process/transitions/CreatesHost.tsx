'use client';

import type { Creates, Process } from '@mas/domain';
import { AddPlanDialog } from '@/features/process/AddPlanDialog';
import { CloseProcessDialog } from '@/features/process/CloseProcessDialog';
import { InvestigationDialog, SupervisionVisitDialog } from '@/features/process/forms/AwiRecordDialogs';
import { CapacityAssessmentDialog } from '@/features/process/forms/CapacityAssessmentDialog';
import { DisclosureDecisionDialog } from '@/features/process/forms/DisclosureDecisionDialog';
import { MappaReferralDialog } from '@/features/process/forms/MappaReferralDialog';
import { RiskAssessmentDialog } from '@/features/process/forms/RiskAssessmentDialog';
import { ProtectionOrderDialog } from '@/features/process/forms/ProtectionOrderDialog';
import { ThreePointTestDialog } from '@/features/process/forms/ThreePointTestDialog';
import { ScheduleMeetingDialog } from '@/features/meetings/ScheduleMeetingDialog';

/**
 * The dialog a `Creates` names, mounted when the engine offers it or when a refusal points at it.
 *
 * A refusal that names what is missing and cannot open the thing that records it is a wall; this
 * is what makes it a route. The dialogs are the ones the screens already open, so a three-point
 * test recorded from a refusal is the same record as one recorded from the panel.
 */
export function CreatesHost({ creates, process, onClose }: { creates: Extract<Creates, { kind: 'dialog' }>; process: Process; onClose: () => void }) {
  switch (creates.dialog) {
    case 'three-point-test':
      return process.type === 'asp' ? <ThreePointTestDialog open onClose={onClose} process={process} /> : null;
    case 'protection-order':
      return process.type === 'asp' ? <ProtectionOrderDialog open onClose={onClose} process={process} /> : null;
    case 'plan':
      return <AddPlanDialog open onClose={onClose} process={process} />;
    case 'close':
      return <CloseProcessDialog open onClose={onClose} process={process} />;
    case 'schedule-meeting':
      return <ScheduleMeetingDialog open onClose={onClose} process={process} meetingType={creates.meetingType} />;
    case 'capacity-assessment':
      return process.type === 'awi' ? <CapacityAssessmentDialog open onClose={onClose} process={process} /> : null;
    case 'supervision-visit':
      return process.type === 'awi' ? <SupervisionVisitDialog open onClose={onClose} process={process} /> : null;
    case 'awi-investigation':
      return process.type === 'awi' ? <InvestigationDialog open onClose={onClose} process={process} /> : null;
    case 'disclosure':
      return process.type === 'mappa' ? <DisclosureDecisionDialog open onClose={onClose} process={process} /> : null;
    case 'mappa-referral':
      return process.type === 'mappa' ? <MappaReferralDialog open onClose={onClose} process={process} /> : null;
    case 'risk-assessment':
      return process.type === 'mappa' ? <RiskAssessmentDialog open onClose={onClose} process={process} /> : null;
  }
}

/** Whether a `Creates` has a dialog to open here, so a refusal can offer a button or only a sentence. */
export function canOpenCreates(creates: Creates, process: Process): boolean {
  if (creates.kind !== 'dialog') return false;
  switch (creates.dialog) {
    case 'three-point-test':
    case 'protection-order':
      return process.type === 'asp';
    case 'capacity-assessment':
    case 'supervision-visit':
    case 'awi-investigation':
      return process.type === 'awi';
    case 'disclosure':
    case 'mappa-referral':
    case 'risk-assessment':
      return process.type === 'mappa';
    default:
      return true;
  }
}
