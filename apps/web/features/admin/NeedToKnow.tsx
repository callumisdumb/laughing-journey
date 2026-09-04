'use client';

import {
  AGENCIES,
  CHANNELS,
  DETAIL_LEVELS,
  PROCESS_TYPES,
  ROLES,
  ROLE_DEFINITIONS,
  STAGES_BY_PROCESS,
  agencyShort,
  detailLevelLabel,
  exclusionSchema,
  matchAudience,
  needToKnowRowSchema,
  processLabel,
  processShort,
  resolveNeedToKnow,
  roleLabel,
  stageLabel,
  type Agency,
  type Channel,
  type DetailLevel,
  type Exclusion,
  type NeedToKnowRow,
  type ProcessType,
  type RoleId,
  type Stage,
} from '@mas/domain';
import { tKey, useT, type Translator } from '@mas/messages';
import { AGENCY_GLYPHS, Button, CheckboxField, Dialog, EmptyState, IconButton, SelectField, Sheet, SheetBody, SheetHead, TabPanel, Table, TableWrap, Tabs, TextField, TextareaField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, Lock, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import styles from './NeedToKnow.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';
import { useAdminConfig } from './useAdminConfig';

type AudienceAgency = NeedToKnowRow['audience']['agency'];
type Party = Exclusion['party'];

const COLUMNS: readonly AudienceAgency[] = [...AGENCIES, 'referrer'];
const ROLE_OPTIONS = [...ROLES, 'any'] as const;
const PARTIES = ['perpetrator', 'perpetrator-associates', 'alleged-perpetrator', 'victim', 'employer', 'public', 'parents-if-risk', 'not-on-distribution'] as const satisfies readonly Party[];

const CHANNEL_KEYS: Record<Channel, string> = { 'in-app': 'inApp', 'secure-email-digest': 'secureEmailDigest', 'connector-push': 'connectorPush' };
const PARTY_KEYS: Record<Party, string> = {
  perpetrator: 'perpetrator',
  'perpetrator-associates': 'perpetratorAssociates',
  'alleged-perpetrator': 'allegedPerpetrator',
  victim: 'victim',
  employer: 'employer',
  public: 'public',
  'parents-if-risk': 'parentsIfRisk',
  'not-on-distribution': 'notOnDistribution',
};

/** The lower-case detail word on a matrix chip: presence, fields, summary or full. */
const detailWord = (level: DetailLevel) => tKey(`admin.needToKnow.detailWord.${level}`);
const channelLabel = (channel: Channel) => tKey(`admin.needToKnow.channel.${CHANNEL_KEYS[channel]}`);
const partyLabel = (party: Party) => tKey(`admin.needToKnow.party.${PARTY_KEYS[party]}`);

/** The brief's hard exclusions: MARAC never tells the perpetrator or their associates; MAPPA never tells victims. */
function isHardExclusion(e: Exclusion): boolean {
  if (e.process === 'marac') return e.party === 'perpetrator' || e.party === 'perpetrator-associates';
  if (e.process === 'mappa') return e.party === 'victim';
  return false;
}

function columnLabel(t: Translator, a: AudienceAgency): string {
  return a === 'referrer' ? t('admin.needToKnow.matrix.referrerColumn') : agencyShort(a);
}

function issueList(t: Translator, issues: Array<{ path: PropertyKey[]; message: string }>): string[] {
  return issues.map((i) => t('admin.config.issue', { path: i.path.map(String).join('.') || t('admin.needToKnow.issueRow'), message: i.message }));
}

function audienceSchema(t: Translator) {
  return z
    .object({
      label: z.string().trim().min(2, t('admin.needToKnow.audienceErrors.label')).max(80),
      role: z.enum(ROLE_OPTIONS),
      detailLevel: z.enum(DETAIL_LEVELS),
      fields: z.string().max(400),
      channel: z.enum(CHANNELS),
      trigger: z.string().trim().min(3, t('admin.needToKnow.audienceErrors.trigger')).max(120),
      condition: z
        .string()
        .trim()
        .max(40)
        .regex(/^[A-Za-z]*$/, t('admin.needToKnow.audienceErrors.condition')),
      conditionLabel: z.string().trim().max(160),
      lawfulBasisHint: z.string().trim().min(5, t('admin.needToKnow.audienceErrors.lawfulBasis')).max(400),
    })
    .superRefine((v, ctx) => {
      const fields = v.fields.split(',').map((s) => s.trim()).filter(Boolean);
      if (v.detailLevel === 'fields' && fields.length === 0) ctx.addIssue({ code: 'custom', path: ['fields'], message: t('admin.needToKnow.audienceErrors.fields') });
      if (v.condition && !v.conditionLabel) ctx.addIssue({ code: 'custom', path: ['conditionLabel'], message: t('admin.needToKnow.audienceErrors.conditionLabel') });
    });
}
type AudienceValues = z.infer<ReturnType<typeof audienceSchema>>;

interface AudienceTarget {
  row?: NeedToKnowRow;
  stage: Stage;
  agency: AudienceAgency;
}

function AudienceDialog({ process, target, canEdit, onClose, onSave, onRemove }: { process: ProcessType; target: AudienceTarget; canEdit: boolean; onClose: () => void; onSave: (row: NeedToKnowRow) => void; onRemove: (id: string) => void }) {
  const t = useT();
  const newId = useAppStore((s) => s.newId);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const row = target.row;
  const schema = useMemo(() => audienceSchema(t), [t]);
  const form = useForm<AudienceValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: row?.audience.label ?? '',
      role: row?.audience.role ?? 'any',
      detailLevel: row?.detailLevel ?? 'summary',
      fields: row?.fields?.join(', ') ?? '',
      channel: row?.channel ?? 'in-app',
      trigger: row?.trigger ?? '',
      condition: row?.condition ?? '',
      conditionLabel: row?.conditionLabel ?? '',
      lawfulBasisHint: row?.lawfulBasisHint ?? '',
    },
  });
  const errors = form.formState.errors;
  const detailLevel = useWatch({ control: form.control, name: 'detailLevel' });
  const roleOptions =
    target.agency === 'referrer'
      ? [{ value: 'any', label: t('admin.needToKnow.audience.anyRoleReferrer') }]
      : [{ value: 'any', label: t('admin.needToKnow.audience.anyRoleAt', { agency: agencyShort(target.agency) }) }, ...ROLES.filter((r) => ROLE_DEFINITIONS[r].agency === target.agency).map((r) => ({ value: r, label: roleLabel(r) }))];

  function submit(values: AudienceValues) {
    const fields = values.fields.split(',').map((s) => s.trim()).filter(Boolean);
    if (target.agency === 'referrer' && values.role !== 'any') {
      setSaveErrors([t('admin.needToKnow.audience.referrerRoleError')]);
      return;
    }
    const candidate = {
      id: row?.id ?? `${process}.${target.stage}.${newId('row')}`,
      process,
      stage: target.stage,
      audience: { agency: target.agency, role: values.role, label: values.label },
      detailLevel: values.detailLevel,
      fields: fields.length > 0 ? fields : undefined,
      channel: values.channel,
      trigger: values.trigger,
      condition: values.condition || undefined,
      conditionLabel: values.conditionLabel || undefined,
      lawfulBasisHint: values.lawfulBasisHint,
    };
    const parsed = needToKnowRowSchema.safeParse(candidate);
    if (!parsed.success) {
      setSaveErrors(issueList(t, parsed.error.issues));
      return;
    }
    onSave(parsed.data);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? t('admin.needToKnow.audience.editTitle', { label: row.audience.label }) : t('admin.needToKnow.audience.addTitle', { stage: stageLabel(process, target.stage), agency: columnLabel(t, target.agency) })}
      size="lg"
      actions={
        <>
          {row && canEdit ? (
            <Button
              variant="danger"
              onClick={() => {
                onRemove(row.id);
                onClose();
              }}
            >
              {t('admin.needToKnow.audience.remove')}
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" disabled={!canEdit} onClick={() => void form.handleSubmit(submit)()}>
            {row ? t('admin.needToKnow.audience.save') : t('admin.needToKnow.audience.add')}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <dl className={styles.facts}>
          <dt>{t('admin.needToKnow.audience.processStage')}</dt>
          <dd>{t('admin.needToKnow.audience.processStageValue', { process: processLabel(process), stage: stageLabel(process, target.stage) })}</dd>
          <dt>{t('admin.needToKnow.audience.agency')}</dt>
          <dd>{target.agency === 'referrer' ? t('admin.needToKnow.audience.referrerAgency') : agencyShort(target.agency)}</dd>
          {row ? (
            <>
              <dt>{t('admin.needToKnow.audience.rowId')}</dt>
              <dd className={styles.mono}>{row.id}</dd>
            </>
          ) : null}
        </dl>
        <TextField label={t('admin.needToKnow.audience.label')} required disabled={!canEdit} maxLength={80} {...form.register('label')} error={errors.label?.message} hint={t('admin.needToKnow.audience.labelHint')} />
        <div className={styles.dialogGrid}>
          <SelectField label={t('admin.needToKnow.audience.role')} required disabled={!canEdit} {...form.register('role')} options={roleOptions} error={errors.role?.message} />
          <SelectField label={t('admin.needToKnow.audience.detailLevel')} required disabled={!canEdit} {...form.register('detailLevel')} options={DETAIL_LEVELS.map((d) => ({ value: d, label: detailLevelLabel(d) }))} error={errors.detailLevel?.message} />
        </div>
        <TextField label={t('admin.needToKnow.audience.fields')} required={detailLevel === 'fields'} disabled={!canEdit} maxLength={400} {...form.register('fields')} error={errors.fields?.message} hint={detailLevel === 'fields' ? t('admin.needToKnow.audience.fieldsHintOnly') : t('admin.needToKnow.audience.fieldsHintOptional')} />
        <div className={styles.dialogGrid}>
          <SelectField label={t('admin.needToKnow.audience.channel')} required disabled={!canEdit} {...form.register('channel')} options={CHANNELS.map((c) => ({ value: c, label: channelLabel(c) }))} error={errors.channel?.message} />
          <TextField label={t('admin.needToKnow.audience.trigger')} required disabled={!canEdit} maxLength={120} {...form.register('trigger')} error={errors.trigger?.message} hint={t('admin.needToKnow.audience.triggerHint')} />
        </div>
        <div className={styles.dialogGrid}>
          <TextField label={t('admin.needToKnow.audience.condition')} disabled={!canEdit} maxLength={40} placeholder={t('admin.needToKnow.audience.conditionPlaceholder')} {...form.register('condition')} error={errors.condition?.message} hint={t('admin.needToKnow.audience.conditionHint')} />
          <TextField label={t('admin.needToKnow.audience.conditionLabel')} disabled={!canEdit} maxLength={160} placeholder={t('admin.needToKnow.audience.conditionLabelPlaceholder')} {...form.register('conditionLabel')} error={errors.conditionLabel?.message} />
        </div>
        <TextareaField label={t('admin.needToKnow.audience.lawfulBasis')} required disabled={!canEdit} maxLength={400} {...form.register('lawfulBasisHint')} error={errors.lawfulBasisHint?.message} hint={t('admin.needToKnow.audience.lawfulBasisHint')} />
        {saveErrors.length > 0 ? (
          <ul className={styles.errors} role="alert">
            {saveErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </Dialog>
  );
}

function exclusionFormSchema(t: Translator) {
  return z.object({
    stage: z.string().min(1, t('admin.needToKnow.exclusionErrors.stage')),
    party: z.enum(PARTIES),
    label: z.string().trim().min(2, t('admin.needToKnow.exclusionErrors.label')).max(80),
    reason: z.string().trim().min(5, t('admin.needToKnow.exclusionErrors.reason')).max(300),
    liftableBy: z.string().trim().max(120),
  });
}
type ExclusionValues = z.infer<ReturnType<typeof exclusionFormSchema>>;

function ExclusionDialog({ process, exclusion, existingIds, canEdit, onClose, onSave }: { process: ProcessType; exclusion?: Exclusion; existingIds: string[]; canEdit: boolean; onClose: () => void; onSave: (e: Exclusion) => void }) {
  const t = useT();
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const stages: readonly Stage[] = STAGES_BY_PROCESS[process];
  const hard = exclusion ? isHardExclusion(exclusion) : false;
  const schema = useMemo(() => exclusionFormSchema(t), [t]);
  const form = useForm<ExclusionValues>({
    resolver: zodResolver(schema),
    defaultValues: { stage: exclusion?.stage ?? '*', party: exclusion?.party ?? 'public', label: exclusion?.label ?? '', reason: exclusion?.reason ?? '', liftableBy: exclusion?.liftableBy ?? '' },
  });
  const errors = form.formState.errors;

  function submit(values: ExclusionValues) {
    let id = exclusion?.id;
    if (!id) {
      const base = `${process}.${values.stage === '*' ? 'all' : values.stage}.${values.party}`;
      id = base;
      let n = 2;
      while (existingIds.includes(id)) id = `${base}-${n++}`;
    }
    const parsed = exclusionSchema.safeParse({ id, process, stage: values.stage, party: values.party, label: values.label, reason: values.reason, liftableBy: values.liftableBy || undefined });
    if (!parsed.success) {
      setSaveErrors(issueList(t, parsed.error.issues));
      return;
    }
    onSave(parsed.data);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={exclusion ? t('admin.needToKnow.exclusion.editTitle', { label: exclusion.label }) : t('admin.needToKnow.exclusion.addTitle', { process: processShort(process) })}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" disabled={!canEdit} onClick={() => void form.handleSubmit(submit)()}>
            {exclusion ? t('admin.needToKnow.exclusion.save') : t('admin.needToKnow.exclusion.add')}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        {hard ? (
          <p className={styles.hardBanner} role="note">
            <Lock size={14} aria-hidden="true" />
            {t('admin.needToKnow.exclusion.hardNote')}
          </p>
        ) : null}
        <div className={styles.dialogGrid}>
          <SelectField label={t('admin.needToKnow.exclusion.stage')} required disabled={!canEdit || hard} {...form.register('stage')} options={[{ value: '*', label: t('admin.needToKnow.exclusion.everyStage') }, ...stages.map((s) => ({ value: s, label: stageLabel(process, s) }))]} error={errors.stage?.message} />
          <SelectField label={t('admin.needToKnow.exclusion.party')} required disabled={!canEdit || hard} {...form.register('party')} options={PARTIES.map((p) => ({ value: p, label: partyLabel(p) }))} error={errors.party?.message} />
        </div>
        <TextField label={t('admin.needToKnow.exclusion.label')} required disabled={!canEdit} maxLength={80} {...form.register('label')} error={errors.label?.message} />
        <TextareaField label={t('admin.needToKnow.exclusion.reason')} required disabled={!canEdit} maxLength={300} {...form.register('reason')} error={errors.reason?.message} />
        <TextField label={t('admin.needToKnow.exclusion.liftableBy')} disabled={!canEdit || hard} maxLength={120} placeholder={t('admin.needToKnow.exclusion.liftablePlaceholder')} {...form.register('liftableBy')} error={errors.liftableBy?.message} hint={t('admin.needToKnow.exclusion.liftableHint')} />
        {saveErrors.length > 0 ? (
          <ul className={styles.errors} role="alert">
            {saveErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </Dialog>
  );
}

function Preview({ process, rows, exclusions }: { process: ProcessType; rows: NeedToKnowRow[]; exclusions: Exclusion[] }) {
  const t = useT();
  const stages: readonly Stage[] = STAGES_BY_PROCESS[process];
  const [stage, setStage] = useState<Stage>(stages[0] ?? 'concern');
  const [agency, setAgency] = useState<Agency>('social-work');
  const [role, setRole] = useState<RoleId>('social-worker-children');
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isReferrer, setIsReferrer] = useState(false);
  const roles = ROLES.filter((r) => ROLE_DEFINITIONS[r].agency === agency);
  const conditions = [...new Map(rows.filter((r) => r.condition).map((r) => [r.condition ?? '', r.conditionLabel ?? r.condition ?? ''])).entries()];
  const ctx = { process, stage, flags, referrerAgency: isReferrer ? agency : undefined };
  const match = matchAudience(agency, role, ctx, rows);
  const res = resolveNeedToKnow(ctx, rows, exclusions);

  function changeAgency(next: Agency) {
    setAgency(next);
    const first = ROLES.find((r) => ROLE_DEFINITIONS[r].agency === next);
    if (first) setRole(first);
  }

  return (
    <div className={styles.preview}>
      <div className={styles.previewControls}>
        <SelectField label={t('admin.needToKnow.preview.stage')} value={stage} onChange={(e) => setStage(e.target.value as Stage)} options={stages.map((s) => ({ value: s, label: stageLabel(process, s) }))} />
        <SelectField label={t('admin.needToKnow.preview.agency')} value={agency} onChange={(e) => changeAgency(e.target.value as Agency)} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} />
        <SelectField label={t('admin.needToKnow.preview.role')} value={role} onChange={(e) => setRole(e.target.value as RoleId)} options={roles.map((r) => ({ value: r, label: roleLabel(r) }))} />
        <CheckboxField label={t('admin.needToKnow.preview.referral')} checked={isReferrer} onChange={(e) => setIsReferrer(e.target.checked)} hint={t('admin.needToKnow.preview.referralHint')} />
        {conditions.length > 0 ? (
          <fieldset className={styles.conditions}>
            <legend className={styles.legendText}>{t('admin.needToKnow.preview.flags')}</legend>
            {conditions.map(([key, label]) => (
              <CheckboxField key={key} label={label} checked={flags[key] ?? false} onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })} />
            ))}
          </fieldset>
        ) : null}
      </div>
      <div className={styles.previewResult} aria-live="polite">
        <div className={styles.previewLevel}>
          {match ? <Eye size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
          {t('admin.needToKnow.preview.level', { role: roleLabel(role), agency: agencyShort(agency), stage: stageLabel(process, stage), level: match ? detailLevelLabel(match.detailLevel) : t('admin.needToKnow.preview.nothing') })}
        </div>
        <dl>
          <div className={styles.previewRow}>
            <dt>{t('admin.needToKnow.preview.rowsApply')}</dt>
            <dd>{match ? match.rowIds.join('; ') : <span className={styles.muted}>{t('admin.needToKnow.preview.rowsNone')}</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>{t('admin.needToKnow.preview.why')}</dt>
            <dd>{match ? match.reasons.join(' ') : <span className={styles.muted}>{t('admin.needToKnow.preview.whyNone')}</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>{t('admin.needToKnow.preview.namedFields')}</dt>
            <dd>{match && match.fields.length > 0 ? match.fields.join('; ') : match?.detailLevel === 'full' ? t('admin.needToKnow.preview.everything') : <span className={styles.muted}>{t('admin.needToKnow.preview.fieldsNone')}</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>{t('admin.needToKnow.preview.lawfulBasis')}</dt>
            <dd>{match ? match.lawfulBasisHints.join(' ') : <span className={styles.muted}>{t('admin.needToKnow.preview.notApplicable')}</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>{t('admin.needToKnow.preview.everyone')}</dt>
            <dd>{res.recipients.length > 0 ? res.recipients.map((r) => t('admin.needToKnow.preview.recipient', { label: r.label, level: detailWord(r.detailLevel) })).join('; ') : <span className={styles.muted}>{t('admin.needToKnow.preview.nobody')}</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>{t('admin.needToKnow.preview.mustNot')}</dt>
            <dd>{res.exclusions.length > 0 ? res.exclusions.map((e) => e.label).join('; ') : <span className={styles.muted}>{t('admin.needToKnow.preview.noExclusions')}</span>}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

interface Draft {
  rows: NeedToKnowRow[];
  exclusions: Exclusion[];
}

export function NeedToKnow() {
  const t = useT();
  const { config, canEdit, save } = useAdminConfig();
  const route = useRoute();
  const navigate = useNavigate();
  const q = route.query.get('process');
  const process: ProcessType = PROCESS_TYPES.includes(q as ProcessType) ? (q as ProcessType) : 'cp';
  const [draft, setDraft] = useState<Draft>({ rows: config.needToKnow, exclusions: config.exclusions });
  const [dirty, setDirty] = useState(false);
  const [changes, setChanges] = useState(0);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [audienceTarget, setAudienceTarget] = useState<AudienceTarget | null>(null);
  const [exclusionTarget, setExclusionTarget] = useState<{ exclusion?: Exclusion } | null>(null);

  const stages: readonly Stage[] = STAGES_BY_PROCESS[process];
  const rows = draft.rows.filter((r) => r.process === process);
  const exclusions = draft.exclusions.filter((e) => e.process === process);

  function touch() {
    setDirty(true);
    setChanges((c) => c + 1);
  }
  function upsertRow(row: NeedToKnowRow) {
    setDraft((d) => ({ ...d, rows: d.rows.some((r) => r.id === row.id) ? d.rows.map((r) => (r.id === row.id ? row : r)) : [...d.rows, row] }));
    touch();
  }
  function removeRow(id: string) {
    setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));
    touch();
  }
  function upsertExclusion(e: Exclusion) {
    setDraft((d) => ({ ...d, exclusions: d.exclusions.some((x) => x.id === e.id) ? d.exclusions.map((x) => (x.id === e.id ? e : x)) : [...d.exclusions, e] }));
    touch();
  }
  function removeExclusion(id: string) {
    const target = draft.exclusions.find((x) => x.id === id);
    if (!target || isHardExclusion(target)) return;
    setDraft((d) => ({ ...d, exclusions: d.exclusions.filter((x) => x.id !== id) }));
    touch();
  }
  function commit() {
    const result = save({ ...config, needToKnow: draft.rows, exclusions: draft.exclusions }, 'need-to-know', t('admin.needToKnow.audit', { process: processShort(process), count: changes }));
    setSaveErrors(result.errors);
    if (result.ok) {
      setDirty(false);
      setChanges(0);
    }
  }
  function discard() {
    setDraft({ rows: config.needToKnow, exclusions: config.exclusions });
    setDirty(false);
    setChanges(0);
    setSaveErrors([]);
  }
  function setProcess(id: string) {
    navigate(`/admin/need-to-know${setQuery(route.query, { process: id })}`, { replace: true });
  }

  return (
    <>
      <SectionHead title={sectionLabel('need-to-know')} lede={t('admin.needToKnow.lede')} />
      <div className={styles.tabs}>
        <Tabs items={PROCESS_TYPES.map((p) => ({ id: p, label: processShort(p), count: draft.rows.filter((r) => r.process === p).length }))} value={process} onChange={setProcess} label={t('admin.needToKnow.tabsLabel')} idPrefix="ntk" />
      </div>
      <TabPanel id={process} active idPrefix="ntk">
        <div className={styles.saveBar} data-state={dirty ? 'dirty' : 'clean'}>
          <span className={styles.saveText} aria-live="polite">
            {dirty ? t('admin.needToKnow.saveBar.dirty', { count: changes }) : t('admin.needToKnow.saveBar.clean')}
          </span>
          <div className={styles.saveActions}>
            <Button variant="quiet" disabled={!dirty} onClick={discard}>
              {t('admin.actions.discardChanges')}
            </Button>
            <Button variant="primary" disabled={!dirty || !canEdit} onClick={commit}>
              {t('admin.needToKnow.saveBar.save')}
            </Button>
          </div>
        </div>
        {saveErrors.length > 0 ? (
          <ul className={styles.errors} role="alert">
            {saveErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        <div className="stack">
          <Sheet>
            <SheetHead title={t('admin.needToKnow.matrix.title', { process: processLabel(process) })} meta={t('admin.needToKnow.matrix.meta')} divided />
            <SheetBody flush>
              <TableWrap label={t('admin.needToKnow.matrix.tableLabel', { process: processShort(process) })} className={styles.wrap}>
                <table className={styles.matrix}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.stageHead}>
                        {t('admin.needToKnow.matrix.stageColumn')}
                      </th>
                      {COLUMNS.map((a) => {
                        if (a === 'referrer') {
                          return (
                            <th key={a} scope="col" className={styles.agencyHead}>
                              <span className={styles.agencyName}>{t('admin.needToKnow.matrix.referrerColumn')}</span>
                            </th>
                          );
                        }
                        const Glyph = AGENCY_GLYPHS[a];
                        return (
                          <th key={a} scope="col" className={styles.agencyHead}>
                            <span className={styles.agencyGlyph} style={{ color: `var(--color-agency-${a})` }}>
                              <Glyph size={16} variant="outline" />
                            </span>
                            <span className={styles.agencyName}>{agencyShort(a)}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {stages.map((stage) => (
                      <tr key={stage}>
                        <th scope="row" className={styles.stageCell}>
                          {stageLabel(process, stage)}
                        </th>
                        {COLUMNS.map((agency) => {
                          const cellRows = rows.filter((r) => r.stage === stage && r.audience.agency === agency);
                          return (
                            <td key={agency} className={styles.cell} data-state={cellRows.length > 0 ? 'filled' : 'empty'}>
                              <div className={styles.chips}>
                                {cellRows.map((r) => (
                                  <button key={r.id} type="button" className={styles.chip} data-level={r.detailLevel} onClick={() => setAudienceTarget({ row: r, stage, agency })}>
                                    {detailWord(r.detailLevel)}
                                    {r.condition ? <span className={styles.cond}> {t('admin.needToKnow.matrix.conditionalMark')}</span> : null}
                                    <span className="visually-hidden">{r.conditionLabel ? t('admin.needToKnow.matrix.chipSrConditional', { label: r.audience.label, condition: r.conditionLabel.toLowerCase() }) : t('admin.needToKnow.matrix.chipSr', { label: r.audience.label })}</span>
                                  </button>
                                ))}
                                {canEdit ? (
                                  <IconButton size="sm" className={styles.add} aria-label={t('admin.needToKnow.audience.addTitle', { stage: stageLabel(process, stage), agency: columnLabel(t, agency) })} onClick={() => setAudienceTarget({ stage, agency })}>
                                    <Plus size={14} aria-hidden="true" />
                                  </IconButton>
                                ) : null}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <p className={styles.legend}>
                {DETAIL_LEVELS.map((d) => (
                  <span key={d} className={styles.chip} data-level={d} data-static="true">
                    {detailWord(d)}
                    <span className={styles.legendLabel}>{t('admin.needToKnow.matrix.legendItem', { label: detailLevelLabel(d).toLowerCase() })}</span>
                  </span>
                ))}
                <span>{t('admin.needToKnow.matrix.legendNote')}</span>
              </p>
            </SheetBody>
          </Sheet>

          <Sheet>
            <SheetHead
              title={t('admin.needToKnow.exclusions.title', { process: processLabel(process) })}
              meta={t('admin.needToKnow.exclusions.meta')}
              actions={
                canEdit ? (
                  <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setExclusionTarget({})}>
                    {t('admin.needToKnow.exclusion.add')}
                  </Button>
                ) : undefined
              }
              divided
            />
            <SheetBody flush>
              {exclusions.length === 0 ? (
                <div className={styles.emptyWrap}>
                  <EmptyState title={t('admin.needToKnow.exclusions.emptyTitle')} text={t('admin.needToKnow.exclusions.emptyText')} />
                </div>
              ) : (
                <TableWrap label={t('admin.needToKnow.exclusions.tableLabel', { process: processShort(process) })} className={styles.wrap}>
                  <Table>
                    <thead>
                      <tr>
                        <th scope="col">{t('admin.needToKnow.exclusions.columnParty')}</th>
                        <th scope="col">{t('admin.needToKnow.exclusions.columnStage')}</th>
                        <th scope="col">{t('admin.needToKnow.exclusions.columnReason')}</th>
                        <th scope="col">{t('admin.needToKnow.exclusions.columnLiftableBy')}</th>
                        <th scope="col">
                          <span className="visually-hidden">{t('common.columns.actions')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {exclusions.map((e) => {
                        const hard = isHardExclusion(e);
                        const noteId = `hard-${e.id.replace(/[^a-z0-9-]/gi, '-')}`;
                        return (
                          <tr key={e.id} data-state={hard ? 'hard' : undefined}>
                            <td>
                              <span className={styles.partyLabel}>{e.label}</span>
                              <span className={styles.partyMeta}>{partyLabel(e.party)}</span>
                              {hard ? (
                                <span id={noteId} className={styles.hardNote}>
                                  <Lock size={12} aria-hidden="true" />
                                  {t('admin.needToKnow.exclusions.hardNote')}
                                </span>
                              ) : null}
                            </td>
                            <td className={styles.nowrap}>{e.stage === '*' ? t('admin.needToKnow.exclusion.everyStage') : stageLabel(process, e.stage)}</td>
                            <td className={styles.reason}>{e.reason}</td>
                            <td className={styles.reason}>{e.liftableBy ?? <span className={styles.muted}>{t('admin.needToKnow.exclusions.cannotBeLifted')}</span>}</td>
                            <td>
                              <div className={styles.rowActions}>
                                <Button size="sm" variant="secondary" onClick={() => setExclusionTarget({ exclusion: e })}>
                                  {canEdit ? t('common.actions.edit') : t('common.actions.view')}
                                  <span className="visually-hidden"> {t('admin.needToKnow.exclusions.rowSr', { label: e.label })}</span>
                                </Button>
                                <Button size="sm" variant="quiet" disabled={!canEdit || hard} title={hard ? t('admin.needToKnow.exclusions.hardNote') : undefined} aria-describedby={hard ? noteId : undefined} onClick={() => removeExclusion(e.id)}>
                                  {t('admin.needToKnow.exclusions.remove')}
                                  <span className="visually-hidden"> {t('admin.needToKnow.exclusions.rowSr', { label: e.label })}</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </SheetBody>
          </Sheet>

          <Sheet>
            <SheetHead title={t('admin.needToKnow.preview.title')} meta={t('admin.needToKnow.preview.meta')} divided />
            <SheetBody>
              <Preview key={process} process={process} rows={rows} exclusions={exclusions} />
            </SheetBody>
          </Sheet>
          {process === 'mappa' ? (
            <p className={styles.hardBanner} role="note">
              <Lock size={14} aria-hidden="true" />
              {t('admin.needToKnow.mappaNote')}
            </p>
          ) : null}
        </div>
      </TabPanel>

      {audienceTarget ? <AudienceDialog process={process} target={audienceTarget} canEdit={canEdit} onClose={() => setAudienceTarget(null)} onSave={upsertRow} onRemove={removeRow} /> : null}
      {exclusionTarget ? <ExclusionDialog process={process} exclusion={exclusionTarget.exclusion} existingIds={draft.exclusions.map((e) => e.id)} canEdit={canEdit} onClose={() => setExclusionTarget(null)} onSave={upsertExclusion} /> : null}
    </>
  );
}
