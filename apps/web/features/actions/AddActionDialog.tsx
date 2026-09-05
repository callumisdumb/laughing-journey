'use client';

import { agencyShort, assignableRoles, assignableUsers, assignmentRefusals, roleLabel, type Action, type Agency, type Process, type RoleId } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, RadioGroup, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { useMemo, useState } from 'react';
import { accessForUser, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';

/**
 * Who an action is given to: a named person the case permits, or every holder of a role.
 *
 * One picker for the add and the reassign dialogs, so the rule about who may own an action on a
 * case is asked in one place (packages/domain/src/actions/assign.ts) and the two forms cannot drift.
 */
export type Owner = { kind: 'person'; userId: string } | { kind: 'role'; agency: Agency; roleId: RoleId };

export function OwnerPicker({ process, value, onChange, idPrefix }: { process: Process; value: Owner | null; onChange: (owner: Owner | null) => void; idPrefix: string }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const ctx = useMemo(() => ({ users: data.users, exclusions: config.exclusions, relationships: data.relationships, rows: config.needToKnow }), [data.users, data.relationships, config.exclusions, config.needToKnow]);
  const people = useMemo(() => assignableUsers(process, ctx).filter((u) => u.roleId !== 'system-administrator'), [process, ctx]);
  const roles = useMemo(() => assignableRoles(process, ctx).filter((r) => r.roleId !== 'system-administrator'), [process, ctx]);
  const kind = value?.kind ?? 'person';
  return (
    <>
      <RadioGroup
        legend={t('actions.add.ownerKind')}
        name={`${idPrefix}-owner-kind`}
        value={kind}
        onChange={(v) => onChange(v === 'role' ? { kind: 'role', agency: roles[0]?.agency ?? 'social-work', roleId: roles[0]?.roleId ?? 'social-worker-adults' } : { kind: 'person', userId: '' })}
        orientation="horizontal"
        options={[
          { value: 'person', label: t('actions.add.ownerPerson') },
          { value: 'role', label: t('actions.add.ownerRole'), hint: t('actions.add.roleHint') },
        ]}
      />
      {kind === 'person' ? (
        <SelectField
          label={t('actions.add.owner')}
          hint={t('actions.add.ownerHint')}
          value={value?.kind === 'person' ? value.userId : ''}
          onChange={(e) => onChange({ kind: 'person', userId: e.target.value })}
          placeholder={t('actions.add.ownerPlaceholder')}
          options={people.map((u) => ({ value: u.id, label: `${userName(u)} (${roleLabel(u.roleId)}, ${agencyShort(u.agency)})` }))}
          required
          data-testid={`${idPrefix}-owner`}
        />
      ) : (
        <SelectField
          label={t('actions.add.role')}
          value={value?.kind === 'role' ? `${value.agency}:${value.roleId}` : ''}
          onChange={(e) => {
            const [agency, roleId] = e.target.value.split(':') as [Agency, RoleId];
            onChange({ kind: 'role', agency, roleId });
          }}
          placeholder={t('actions.add.rolePlaceholder')}
          options={roles.map((r) => ({ value: `${r.agency}:${r.roleId}`, label: t('actions.add.roleOption', { role: roleLabel(r.roleId), agency: agencyShort(r.agency), count: r.holders }) }))}
          required
          data-testid={`${idPrefix}-owner-role`}
        />
      )}
    </>
  );
}

/** The owner fields an action record carries, from a picker value. */
export function ownerFields(data: ReturnType<typeof useData>, owner: Owner): Pick<Action, 'ownerUserId' | 'ownerRoleId' | 'ownerName' | 'ownerAgency'> | null {
  if (owner.kind === 'person') {
    const user = data.users.find((u) => u.id === owner.userId);
    if (!user) return null;
    return { ownerUserId: user.id, ownerRoleId: undefined, ownerName: userName(user), ownerAgency: user.agency };
  }
  return { ownerUserId: undefined, ownerRoleId: owner.roleId, ownerName: `${roleLabel(owner.roleId)}, ${agencyShort(owner.agency)}`, ownerAgency: owner.agency };
}

export function useAssignmentContext() {
  const data = useData();
  const config = useConfig();
  return useMemo(() => ({ users: data.users, exclusions: config.exclusions, relationships: data.relationships, rows: config.needToKnow }), [data.users, data.relationships, config.exclusions, config.needToKnow]);
}

interface AddActionProps {
  open: boolean;
  onClose: () => void;
  /** The case, where the screen knows it. Otherwise the dialog asks first. */
  process?: Process;
  planId?: string;
  meetingId?: string;
  onCreated?: (action: Action) => void;
}

/**
 * Adding an action: from the Actions screen, from a case, from a plan, from a meeting and from the
 * global create menu, all through this one dialog and the one write.
 *
 * The owner is a person or a role the case permits, the due date is required, and the write goes
 * through the pipeline with the assignment rule as its business rule, so an excluded party or a
 * person who cannot open the case is refused here in the same words as everywhere else. The
 * assignee is told by the pipeline, not by this dialog.
 */
export function AddActionDialog({ open, onClose, process: fixed, planId: fixedPlanId, meetingId, onCreated }: AddActionProps) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const grants = useGrants();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const ctx = useAssignmentContext();
  const { toast } = useToast();
  const [processId, setProcessId] = useState(fixed?.id ?? '');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [owner, setOwner] = useState<Owner | null>(null);
  const [due, setDue] = useState('');
  const [planId, setPlanId] = useState(fixedPlanId ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  const choices = useMemo(() => (user ? data.processes.filter((p) => p.status === 'open' && accessForUser(data, config, user, p, grants, now).level === 'full') : []), [data, config, user, grants, now]);
  const process = fixed ?? choices.find((p) => p.id === processId);
  const plans = process ? data.plans.filter((p) => p.processId === process.id && p.status !== 'ended') : [];

  function submit() {
    if (!user) return;
    const refusals: string[] = [];
    if (!process) refusals.push('actionProcessRequired');
    if (title.trim().length < 5) refusals.push('actionTitleRequired');
    if (!due) refusals.push('actionDueRequired');
    if (!owner || (owner.kind === 'person' && !owner.userId)) refusals.push('assigneeMissing');
    if (refusals.length > 0 || !process || !owner) {
      setErrors(refusals);
      return;
    }
    const fields = ownerFields(data, owner);
    if (!fields) {
      setErrors(['assigneeMissing']);
      return;
    }
    const record: Action = {
      id: newId('act'),
      synthetic: true,
      processId: process.id,
      planId: planId || undefined,
      meetingId,
      title: title.trim(),
      detail: detail.trim() || undefined,
      ...fields,
      due,
      status: 'open',
      createdAt: now.toISOString(),
      createdByName: userName(user),
      createdByUserId: user.id,
    };
    const result = write({
      collection: 'actions',
      record,
      intent: 'create',
      act: 'create',
      targetType: 'process',
      targetLabel: t('actions.add.audit', { title: record.title, owner: record.ownerName }),
      processId: process.id,
      rules: assignmentRefusals(process, owner.kind === 'person' ? { userId: owner.userId } : { agency: owner.agency, roleId: owner.roleId }, ctx),
      recipients: owner.kind === 'person' ? [{ userId: owner.userId, name: fields.ownerName }] : [],
      recipientProcess: process,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('actions.add.toastTitle'), text: t('actions.add.toastText', { owner: record.ownerName }), tone: 'success' });
    onCreated?.(record);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={process ? t('actions.add.titleFor', { reference: process.reference }) : t('actions.add.title')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="action-submit">
            {t('actions.add.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {fixed ? null : choices.length === 0 ? (
          <p data-testid="action-no-cases">{t('actions.add.noCases')}</p>
        ) : (
          <SelectField label={t('actions.add.case')} hint={t('actions.add.caseHint')} value={processId} onChange={(e) => { setProcessId(e.target.value); setOwner(null); setPlanId(''); }} placeholder={t('actions.add.casePlaceholder')} options={choices.map((p) => ({ value: p.id, label: `${p.reference}: ${p.title}` }))} required data-testid="action-case" />
        )}
        <TextField label={t('actions.add.actionTitle')} hint={t('actions.add.actionTitleHint')} value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="action-title" />
        <TextareaField label={t('actions.add.detail')} hint={t('actions.add.detailHint')} value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} data-testid="action-detail" />
        {process ? <OwnerPicker process={process} value={owner} onChange={setOwner} idPrefix="action" /> : null}
        <DateField label={t('actions.add.due')} hint={null} value={due} onChange={setDue} required data-testid="action-due" />
        {process && plans.length > 0 && !fixedPlanId ? (
          <SelectField label={t('actions.add.plan')} value={planId} onChange={(e) => setPlanId(e.target.value)} options={[{ value: '', label: t('actions.add.planNone') }, ...plans.map((p) => ({ value: p.id, label: p.title }))]} data-testid="action-plan" />
        ) : null}
      </div>
    </Dialog>
  );
}

/** Reassigning an action to a person or a role the case permits. Both people are told by the pipeline. */
export function ReassignDialog({ action, process, open, onClose }: { action: Action; process: Process; open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const write = useAppStore((s) => s.write);
  const readErrors = useWriteErrors();
  const ctx = useAssignmentContext();
  const { toast } = useToast();
  const [owner, setOwner] = useState<Owner | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    if (!owner || (owner.kind === 'person' && !owner.userId)) {
      setErrors(['assigneeMissing']);
      return;
    }
    const fields = ownerFields(data, owner);
    if (!fields) {
      setErrors(['assigneeMissing']);
      return;
    }
    const label = t('actions.reassign.audit', { from: action.ownerName, to: fields.ownerName, title: action.title });
    const result = write({
      collection: 'actions',
      record: { ...action, ...fields },
      intent: 'update',
      act: 'edit',
      targetType: 'process',
      targetLabel: label,
      processId: action.processId,
      versionChange: label,
      rules: assignmentRefusals(process, owner.kind === 'person' ? { userId: owner.userId } : { agency: owner.agency, roleId: owner.roleId }, ctx),
      recipients: owner.kind === 'person' ? [{ userId: owner.userId, name: fields.ownerName }] : [],
      recipientProcess: process,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('actions.reassign.toastTitle', { owner: fields.ownerName }), text: t('actions.reassign.toastText'), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('actions.reassign.title')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="action-reassign-submit">
            {t('actions.reassign.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>{action.title}</p>
        <OwnerPicker process={process} value={owner} onChange={setOwner} idPrefix="reassign" />
      </div>
    </Dialog>
  );
}

/** Cancelling an action with a reason. It stays on the record. */
export function CancelActionDialog({ action, open, onClose }: { action: Action; open: boolean; onClose: () => void }) {
  const t = useT();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    if (reason.trim().length < 10) {
      setErrors(['cancelReasonRequired']);
      return;
    }
    const label = t('actions.cancel.audit', { title: action.title, reason: reason.trim() });
    const result = write({ collection: 'actions', record: { ...action, status: 'cancelled', cancelledAt: now.toISOString(), cancelReason: reason.trim() }, intent: 'update', act: 'edit', targetType: 'process', targetLabel: label, processId: action.processId, reason: reason.trim(), versionChange: label });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('actions.cancel.toastTitle'), text: t('actions.cancel.toastText'), tone: 'info' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('actions.cancel.title')}
      size="sm"
      tone="destructive"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="danger" onClick={submit} data-testid="action-cancel-submit">
            {t('actions.cancel.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>{action.title}</p>
        <TextareaField label={t('actions.cancel.reason')} hint={t('actions.cancel.reasonHint')} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required data-testid="action-cancel-reason" />
      </div>
    </Dialog>
  );
}
