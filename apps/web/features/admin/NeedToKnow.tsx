'use client';

import {
  AGENCIES,
  AGENCY_SHORT,
  CHANNELS,
  DETAIL_LEVELS,
  DETAIL_LEVEL_LABELS,
  PROCESS_LABELS,
  PROCESS_SHORT,
  PROCESS_TYPES,
  ROLES,
  ROLE_DEFINITIONS,
  STAGES_BY_PROCESS,
  exclusionSchema,
  matchAudience,
  needToKnowRowSchema,
  resolveNeedToKnow,
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
import { AGENCY_GLYPHS, Button, CheckboxField, Dialog, EmptyState, IconButton, SelectField, Sheet, SheetBody, SheetHead, TabPanel, Table, TableWrap, Tabs, TextField, TextareaField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useAppStore } from '@/lib/store';
import styles from './NeedToKnow.module.css';
import { SectionHead } from './SectionHead';
import { useAdminConfig } from './useAdminConfig';

type AudienceAgency = NeedToKnowRow['audience']['agency'];
type Party = Exclusion['party'];

const COLUMNS: readonly AudienceAgency[] = [...AGENCIES, 'referrer'];
const ROLE_OPTIONS = [...ROLES, 'any'] as const;
const PARTIES = ['perpetrator', 'perpetrator-associates', 'alleged-perpetrator', 'victim', 'employer', 'public', 'parents-if-risk', 'not-on-distribution'] as const satisfies readonly Party[];

const DETAIL_WORD: Record<DetailLevel, string> = { presence: 'presence', fields: 'fields', summary: 'summary', full: 'full' };
const CHANNEL_LABELS: Record<Channel, string> = { 'in-app': 'In app', 'secure-email-digest': 'Secure email digest', 'connector-push': 'Connector push' };
const PARTY_LABELS: Record<Party, string> = {
  perpetrator: 'Perpetrator',
  'perpetrator-associates': "Perpetrator's family or associates",
  'alleged-perpetrator': 'Alleged perpetrator',
  victim: 'Victims',
  employer: 'Employers',
  public: 'Public',
  'parents-if-risk': 'Parents and carers where sharing increases risk',
  'not-on-distribution': 'Anyone not on the distribution list',
};
const HARD_TEXT = 'Hard exclusion from the brief; cannot be lifted in the UI';

/** The brief's hard exclusions: MARAC never tells the perpetrator or their associates; MAPPA never tells victims. */
function isHardExclusion(e: Exclusion): boolean {
  if (e.process === 'marac') return e.party === 'perpetrator' || e.party === 'perpetrator-associates';
  if (e.process === 'mappa') return e.party === 'victim';
  return false;
}

function columnLabel(a: AudienceAgency): string {
  return a === 'referrer' ? 'Referrer' : AGENCY_SHORT[a];
}

function issueList(issues: Array<{ path: PropertyKey[]; message: string }>): string[] {
  return issues.map((i) => `${i.path.map(String).join('.') || 'row'}: ${i.message}`);
}

const audienceSchema = z
  .object({
    label: z.string().trim().min(2, 'Name the audience, for example "Social work senior"').max(80),
    role: z.enum(ROLE_OPTIONS),
    detailLevel: z.enum(DETAIL_LEVELS),
    fields: z.string().max(400),
    channel: z.enum(CHANNELS),
    trigger: z.string().trim().min(3, 'Say what triggers the notification, for example "IRD convened"').max(120),
    condition: z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z]*$/, 'A flag name in letters only, for example schoolAge'),
    conditionLabel: z.string().trim().max(160),
    lawfulBasisHint: z.string().trim().min(5, 'Give the lawful basis the recipient will see').max(400),
  })
  .superRefine((v, ctx) => {
    const fields = v.fields.split(',').map((s) => s.trim()).filter(Boolean);
    if (v.detailLevel === 'fields' && fields.length === 0) ctx.addIssue({ code: 'custom', path: ['fields'], message: 'Named fields only needs at least one field, separated by commas' });
    if (v.condition && !v.conditionLabel) ctx.addIssue({ code: 'custom', path: ['conditionLabel'], message: 'Say the condition in plain words, for example "If the child is school-age"' });
  });
type AudienceValues = z.infer<typeof audienceSchema>;

interface AudienceTarget {
  row?: NeedToKnowRow;
  stage: Stage;
  agency: AudienceAgency;
}

function AudienceDialog({ process, target, canEdit, onClose, onSave, onRemove }: { process: ProcessType; target: AudienceTarget; canEdit: boolean; onClose: () => void; onSave: (row: NeedToKnowRow) => void; onRemove: (id: string) => void }) {
  const newId = useAppStore((s) => s.newId);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const row = target.row;
  const form = useForm<AudienceValues>({
    resolver: zodResolver(audienceSchema),
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
  const detailLevel = form.watch('detailLevel');
  const roleOptions =
    target.agency === 'referrer'
      ? [{ value: 'any', label: 'Any role at the referring agency' }]
      : [{ value: 'any', label: `Any role at ${AGENCY_SHORT[target.agency]}` }, ...ROLES.filter((r) => ROLE_DEFINITIONS[r].agency === target.agency).map((r) => ({ value: r, label: ROLE_DEFINITIONS[r].label }))];

  function submit(values: AudienceValues) {
    const fields = values.fields.split(',').map((s) => s.trim()).filter(Boolean);
    if (target.agency === 'referrer' && values.role !== 'any') {
      setSaveErrors(['role: the referrer audience applies to any role at the referring agency']);
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
      setSaveErrors(issueList(parsed.error.issues));
      return;
    }
    onSave(parsed.data);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? `Edit audience: ${row.audience.label}` : `Add audience: ${stageLabel(process, target.stage)}, ${columnLabel(target.agency)}`}
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
              Remove this audience
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canEdit} onClick={() => void form.handleSubmit(submit)()}>
            {row ? 'Save audience' : 'Add audience'}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <dl className={styles.facts}>
          <dt>Process and stage</dt>
          <dd>
            {PROCESS_LABELS[process]}, {stageLabel(process, target.stage)}
          </dd>
          <dt>Agency</dt>
          <dd>{target.agency === 'referrer' ? 'The referring agency, resolved from the process at runtime' : AGENCY_SHORT[target.agency]}</dd>
          {row ? (
            <>
              <dt>Row id</dt>
              <dd className={styles.mono}>{row.id}</dd>
            </>
          ) : null}
        </dl>
        <TextField label="Audience label" required disabled={!canEdit} maxLength={80} {...form.register('label')} error={errors.label?.message} hint="What the recipient is called on the distribution list and in the drawer." />
        <div className={styles.dialogGrid}>
          <SelectField label="Role" required disabled={!canEdit} {...form.register('role')} options={roleOptions} error={errors.role?.message} />
          <SelectField label="Detail level" required disabled={!canEdit} {...form.register('detailLevel')} options={DETAIL_LEVELS.map((d) => ({ value: d, label: DETAIL_LEVEL_LABELS[d] }))} error={errors.detailLevel?.message} />
        </div>
        <TextField label="Named fields (comma separated)" required={detailLevel === 'fields'} disabled={!canEdit} maxLength={400} {...form.register('fields')} error={errors.fields?.message} hint={detailLevel === 'fields' ? 'Only these fields are shared, nothing else.' : 'Optional. Fields shared in addition to the detail level.'} />
        <div className={styles.dialogGrid}>
          <SelectField label="Channel" required disabled={!canEdit} {...form.register('channel')} options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }))} error={errors.channel?.message} />
          <TextField label="Trigger" required disabled={!canEdit} maxLength={120} {...form.register('trigger')} error={errors.trigger?.message} hint="The event that sends the notification." />
        </div>
        <div className={styles.dialogGrid}>
          <TextField label="Condition flag" disabled={!canEdit} maxLength={40} placeholder="e.g. schoolAge" {...form.register('condition')} error={errors.condition?.message} hint="A flag on the process that must be true. Leave blank if the row always applies." />
          <TextField label="Condition in plain words" disabled={!canEdit} maxLength={160} placeholder="e.g. If the child is school-age" {...form.register('conditionLabel')} error={errors.conditionLabel?.message} />
        </div>
        <TextareaField label="Lawful basis hint" required disabled={!canEdit} maxLength={400} {...form.register('lawfulBasisHint')} error={errors.lawfulBasisHint?.message} hint="Shown to the recipient with every notification under this row." />
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

const exclusionFormSchema = z.object({
  stage: z.string().min(1, 'Choose a stage'),
  party: z.enum(PARTIES),
  label: z.string().trim().min(2, 'Name who is excluded').max(80),
  reason: z.string().trim().min(5, 'Say why they must not receive it').max(300),
  liftableBy: z.string().trim().max(120),
});
type ExclusionValues = z.infer<typeof exclusionFormSchema>;

function ExclusionDialog({ process, exclusion, existingIds, canEdit, onClose, onSave }: { process: ProcessType; exclusion?: Exclusion; existingIds: string[]; canEdit: boolean; onClose: () => void; onSave: (e: Exclusion) => void }) {
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const stages: readonly Stage[] = STAGES_BY_PROCESS[process];
  const hard = exclusion ? isHardExclusion(exclusion) : false;
  const form = useForm<ExclusionValues>({
    resolver: zodResolver(exclusionFormSchema),
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
      setSaveErrors(issueList(parsed.error.issues));
      return;
    }
    onSave(parsed.data);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={exclusion ? `Edit exclusion: ${exclusion.label}` : `Add exclusion: ${PROCESS_SHORT[process]}`}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canEdit} onClick={() => void form.handleSubmit(submit)()}>
            {exclusion ? 'Save exclusion' : 'Add exclusion'}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        {hard ? (
          <p className={styles.hardBanner} role="note">
            <Lock size={14} aria-hidden="true" />
            {HARD_TEXT}. The wording can change; the party and stage cannot.
          </p>
        ) : null}
        <div className={styles.dialogGrid}>
          <SelectField label="Stage" required disabled={!canEdit || hard} {...form.register('stage')} options={[{ value: '*', label: 'Every stage' }, ...stages.map((s) => ({ value: s, label: stageLabel(process, s) }))]} error={errors.stage?.message} />
          <SelectField label="Party" required disabled={!canEdit || hard} {...form.register('party')} options={PARTIES.map((p) => ({ value: p, label: PARTY_LABELS[p] }))} error={errors.party?.message} />
        </div>
        <TextField label="Label" required disabled={!canEdit} maxLength={80} {...form.register('label')} error={errors.label?.message} />
        <TextareaField label="Reason" required disabled={!canEdit} maxLength={300} {...form.register('reason')} error={errors.reason?.message} />
        <TextField label="Can be lifted by" disabled={!canEdit || hard} maxLength={120} placeholder="e.g. Chair's recorded decision" {...form.register('liftableBy')} error={errors.liftableBy?.message} hint="Leave blank if the exclusion can never be lifted." />
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
        <SelectField label="Stage" value={stage} onChange={(e) => setStage(e.target.value as Stage)} options={stages.map((s) => ({ value: s, label: stageLabel(process, s) }))} />
        <SelectField label="Agency" value={agency} onChange={(e) => changeAgency(e.target.value as Agency)} options={AGENCIES.map((a) => ({ value: a, label: AGENCY_SHORT[a] }))} />
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as RoleId)} options={roles.map((r) => ({ value: r, label: ROLE_DEFINITIONS[r].label }))} />
        <CheckboxField label="This agency made the referral" checked={isReferrer} onChange={(e) => setIsReferrer(e.target.checked)} hint="Rows addressed to the referrer resolve to this agency." />
        {conditions.length > 0 ? (
          <fieldset className={styles.conditions}>
            <legend className={styles.legendText}>Process flags</legend>
            {conditions.map(([key, label]) => (
              <CheckboxField key={key} label={label} checked={flags[key] ?? false} onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })} />
            ))}
          </fieldset>
        ) : null}
      </div>
      <div className={styles.previewResult} aria-live="polite">
        <div className={styles.previewLevel}>
          {match ? <Eye size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
          {ROLE_DEFINITIONS[role].label} ({AGENCY_SHORT[agency]}) at {stageLabel(process, stage)}: {match ? DETAIL_LEVEL_LABELS[match.detailLevel] : 'nothing, default deny'}
        </div>
        <dl>
          <div className={styles.previewRow}>
            <dt>Rows that apply</dt>
            <dd>{match ? match.rowIds.join('; ') : <span className={styles.muted}>None. Case membership would still grant full access.</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>Why</dt>
            <dd>{match ? match.reasons.join(' ') : <span className={styles.muted}>No row names this agency and role at this stage.</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>Named fields</dt>
            <dd>{match && match.fields.length > 0 ? match.fields.join('; ') : match?.detailLevel === 'full' ? 'Everything' : <span className={styles.muted}>None</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>Lawful basis shown</dt>
            <dd>{match ? match.lawfulBasisHints.join(' ') : <span className={styles.muted}>Not applicable</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>Everyone told at this stage</dt>
            <dd>{res.recipients.length > 0 ? res.recipients.map((r) => `${r.label} (${DETAIL_WORD[r.detailLevel]})`).join('; ') : <span className={styles.muted}>Nobody with the current flags</span>}</dd>
          </div>
          <div className={styles.previewRow}>
            <dt>Must not receive</dt>
            <dd>{res.exclusions.length > 0 ? res.exclusions.map((e) => e.label).join('; ') : <span className={styles.muted}>No exclusions at this stage</span>}</dd>
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
    const result = save({ ...config, needToKnow: draft.rows, exclusions: draft.exclusions }, 'need-to-know', `${PROCESS_SHORT[process]} need-to-know: ${changes} ${changes === 1 ? 'change' : 'changes'}`);
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
      <SectionHead title="Need-to-know" lede="Who is told what at each stage of each process, and who must never be. Default is deny: a person sees what a row for their agency and role allows, or what case membership grants. Changes are held here until you save them." />
      <div className={styles.tabs}>
        <Tabs items={PROCESS_TYPES.map((p) => ({ id: p, label: PROCESS_SHORT[p], count: draft.rows.filter((r) => r.process === p).length }))} value={process} onChange={setProcess} label="Process" idPrefix="ntk" />
      </div>
      <TabPanel id={process} active idPrefix="ntk">
        <div className={styles.saveBar} data-state={dirty ? 'dirty' : 'clean'}>
          <span className={styles.saveText} aria-live="polite">
            {dirty ? `${changes} unsaved ${changes === 1 ? 'change' : 'changes'} across the matrix and exclusions. The preview below already reflects them.` : 'No unsaved changes.'}
          </span>
          <div className={styles.saveActions}>
            <Button variant="quiet" disabled={!dirty} onClick={discard}>
              Discard changes
            </Button>
            <Button variant="primary" disabled={!dirty || !canEdit} onClick={commit}>
              Save need-to-know
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
            <SheetHead title={`${PROCESS_LABELS[process]}: who is told what`} meta="Rows are stages in statutory order; columns are agencies. Each chip is an audience row showing its detail level. Choose a chip to edit it." divided />
            <SheetBody flush>
              <TableWrap label={`${PROCESS_SHORT[process]} need-to-know matrix`} className={styles.wrap}>
                <table className={styles.matrix}>
                  <thead>
                    <tr>
                      <th scope="col" className={styles.stageHead}>
                        Stage
                      </th>
                      {COLUMNS.map((a) => {
                        if (a === 'referrer') {
                          return (
                            <th key={a} scope="col" className={styles.agencyHead}>
                              <span className={styles.agencyName}>Referrer</span>
                            </th>
                          );
                        }
                        const Glyph = AGENCY_GLYPHS[a];
                        return (
                          <th key={a} scope="col" className={styles.agencyHead}>
                            <span className={styles.agencyGlyph} style={{ color: `var(--color-agency-${a})` }}>
                              <Glyph size={16} variant="outline" />
                            </span>
                            <span className={styles.agencyName}>{AGENCY_SHORT[a]}</span>
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
                                    {DETAIL_WORD[r.detailLevel]}
                                    {r.condition ? <span className={styles.cond}> (if)</span> : null}
                                    <span className="visually-hidden">
                                      : {r.audience.label}
                                      {r.conditionLabel ? `, ${r.conditionLabel.toLowerCase()}` : ''}. Edit
                                    </span>
                                  </button>
                                ))}
                                {canEdit ? (
                                  <IconButton size="sm" className={styles.add} aria-label={`Add audience: ${stageLabel(process, stage)}, ${columnLabel(agency)}`} onClick={() => setAudienceTarget({ stage, agency })}>
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
                    {DETAIL_WORD[d]}
                    <span className={styles.legendLabel}>: {DETAIL_LEVEL_LABELS[d].toLowerCase()}</span>
                  </span>
                ))}
                <span>(if) marks a row that applies only when a process flag is set.</span>
              </p>
            </SheetBody>
          </Sheet>

          <Sheet>
            <SheetHead
              title={`${PROCESS_LABELS[process]}: must not receive`}
              meta="Hard exclusions from the brief cannot be lifted in the UI. Others can be changed here, and some can be lifted by a recorded decision on the case."
              actions={
                canEdit ? (
                  <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setExclusionTarget({})}>
                    Add exclusion
                  </Button>
                ) : undefined
              }
              divided
            />
            <SheetBody flush>
              {exclusions.length === 0 ? (
                <div className={styles.emptyWrap}>
                  <EmptyState title="No exclusions for this process" text="Add one when a party must never receive information at a stage, and say why." />
                </div>
              ) : (
                <TableWrap label={`${PROCESS_SHORT[process]} exclusions`} className={styles.wrap}>
                  <Table>
                    <thead>
                      <tr>
                        <th scope="col">Party</th>
                        <th scope="col">Stage</th>
                        <th scope="col">Reason</th>
                        <th scope="col">Can be lifted by</th>
                        <th scope="col">
                          <span className="visually-hidden">Actions</span>
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
                              <span className={styles.partyMeta}>{PARTY_LABELS[e.party]}</span>
                              {hard ? (
                                <span id={noteId} className={styles.hardNote}>
                                  <Lock size={12} aria-hidden="true" />
                                  {HARD_TEXT}
                                </span>
                              ) : null}
                            </td>
                            <td className={styles.nowrap}>{e.stage === '*' ? 'Every stage' : stageLabel(process, e.stage)}</td>
                            <td className={styles.reason}>{e.reason}</td>
                            <td className={styles.reason}>{e.liftableBy ?? <span className={styles.muted}>Cannot be lifted</span>}</td>
                            <td>
                              <div className={styles.rowActions}>
                                <Button size="sm" variant="secondary" onClick={() => setExclusionTarget({ exclusion: e })}>
                                  {canEdit ? 'Edit' : 'View'}
                                  <span className="visually-hidden"> exclusion: {e.label}</span>
                                </Button>
                                <Button size="sm" variant="quiet" disabled={!canEdit || hard} title={hard ? HARD_TEXT : undefined} aria-describedby={hard ? noteId : undefined} onClick={() => removeExclusion(e.id)}>
                                  Remove<span className="visually-hidden"> exclusion: {e.label}</span>
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
            <SheetHead title="Preview: what a role would get" meta="Resolved with the matrix as edited above, before you save it. Pick a stage, an agency and a role; set the process flags that apply." divided />
            <SheetBody>
              <Preview key={process} process={process} rows={rows} exclusions={exclusions} />
            </SheetBody>
          </Sheet>
          {process === 'mappa' ? (
            <p className={styles.hardBanner} role="note">
              <Lock size={14} aria-hidden="true" />
              MAPPA records are restricted: the distribution list on each meeting, not this matrix alone, decides who reads the minute.
            </p>
          ) : null}
        </div>
      </TabPanel>

      {audienceTarget ? <AudienceDialog process={process} target={audienceTarget} canEdit={canEdit} onClose={() => setAudienceTarget(null)} onSave={upsertRow} onRemove={removeRow} /> : null}
      {exclusionTarget ? <ExclusionDialog process={process} exclusion={exclusionTarget.exclusion} existingIds={draft.exclusions.map((e) => e.id)} canEdit={canEdit} onClose={() => setExclusionTarget(null)} onSave={upsertExclusion} /> : null}
    </>
  );
}
