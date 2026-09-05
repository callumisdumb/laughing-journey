'use client';

import { formatDate, type AwiDetail, type AwiProcess } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Button, DateField, Dialog, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';
import { userName } from '@/lib/selectors';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './records.module.css';

type Investigation = AwiDetail['investigations'][number];
type Section = Investigation['section'];

const SECTIONS = ['s10', 's12'] as const satisfies readonly Section[];
const sectionLabel = (section: Section) => tKey(`awi.supervision.section.${section}`);

/**
 * A supervision visit on a welfare guardianship.
 *
 * The visitor's name is a field rather than the signed-in user, because the person who visited is
 * often not the person recording the visit, and a record that quietly claims otherwise is worse than
 * one that asks. It defaults to the signed-in user, which is the common case.
 */
export function SupervisionVisitDialog({ process, open, onClose }: { process: AwiProcess; open: boolean; onClose: () => void }) {
  const t = useT();
  const user = useCurrentUser();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [at, setAt] = useState(now.toISOString().slice(0, 10));
  const [byName, setByName] = useState(user ? userName(user) : '');
  const [summary, setSummary] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const visit = { at, byName: byName.trim(), summary: summary.trim() };
    const rules: string[] = [];
    if (visit.byName === '') rules.push('visitVisitorRequired');
    if (visit.summary.length < 10) rules.push('visitSummaryRequired');
    if (visit.at > now.toISOString().slice(0, 10)) rules.push('visitInFuture');

    const result = write({
      collection: 'processes',
      record: { ...process, detail: { ...process.detail, supervisionVisits: [...process.detail.supervisionVisits, visit] } },
      intent: 'update',
      act: 'edit',
      targetType: 'process',
      targetLabel: t('awi.supervision.visitAudit', { date: formatDate(at) }),
      processId: process.id,
      rules,
      event: {
        eventType: 'social-work.visit',
        significance: 'moderate',
        visibility: 'integrated',
        title: t('awi.supervision.visitEventTitle'),
        detail: visit.summary,
        subjectIds: process.subjectIds,
        occurredAt: `${at}T${now.toISOString().slice(11, 19)}Z`,
        linkedProcessIds: [process.id],
      },
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('awi.supervision.visitDone.title'), text: t('awi.supervision.visitDone.text', { date: formatDate(at) }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('awi.supervision.visitTitle')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="visit-submit">
            {t('awi.supervision.visitSubmit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className={styles.grid}>
          <DateField label={t('awi.supervision.visitDate')} value={at} onChange={setAt} data-testid="visit-date" />
          <TextField label={t('awi.supervision.visitBy')} value={byName} onChange={(e) => setByName(e.target.value)} required data-testid="visit-by" />
        </div>
        <TextareaField label={t('awi.supervision.visitSummary')} hint={t('awi.supervision.visitSummaryHint')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} required data-testid="visit-summary" />
      </div>
    </Dialog>
  );
}

/**
 * An investigation under section 10 or section 12 of the 2000 Act.
 *
 * Section 10 is the local authority's duty to investigate complaints about a welfare guardian or
 * attorney; section 12 is the duty to investigate circumstances where the personal welfare of an
 * adult seems at risk. Which section is being used decides who else has a duty here, so the dialog
 * asks rather than filing everything under one heading.
 */
export function InvestigationDialog({ process, open, onClose }: { process: AwiProcess; open: boolean; onClose: () => void }) {
  const t = useT();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [section, setSection] = useState<Section>('s10');
  const [openedAt, setOpenedAt] = useState(now.toISOString().slice(0, 10));
  const [summary, setSummary] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    const investigation: Investigation = { section, openedAt, summary: summary.trim(), status: 'open' };
    const rules: string[] = [];
    if (investigation.summary.length < 10) rules.push('investigationSummaryRequired');
    if (investigation.openedAt > now.toISOString().slice(0, 10)) rules.push('investigationInFuture');

    const result = write({
      collection: 'processes',
      record: { ...process, detail: { ...process.detail, investigations: [...process.detail.investigations, investigation] } },
      intent: 'update',
      act: 'edit',
      targetType: 'process',
      targetLabel: t('awi.supervision.investigationAudit', { section: sectionLabel(section) }),
      processId: process.id,
      rules,
      event: {
        eventType: 'social-work.assessment',
        significance: 'high',
        visibility: 'integrated',
        title: t('awi.supervision.investigationEventTitle', { section: sectionLabel(section) }),
        detail: investigation.summary,
        subjectIds: process.subjectIds,
        occurredAt: `${openedAt}T${now.toISOString().slice(11, 19)}Z`,
        linkedProcessIds: [process.id],
      },
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('awi.supervision.investigationDone.title'), text: t('awi.supervision.investigationDone.text', { section: sectionLabel(section) }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('awi.supervision.investigationTitle')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="investigation-submit">
            {t('awi.supervision.investigationSubmit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className={styles.grid}>
          <SelectField label={t('awi.supervision.sectionLabel')} value={section} onChange={(e) => setSection(e.target.value as Section)} options={SECTIONS.map((s) => ({ value: s, label: sectionLabel(s) }))} data-testid="investigation-section" />
          <DateField label={t('awi.supervision.investigationOpened')} value={openedAt} onChange={setOpenedAt} data-testid="investigation-opened" />
        </div>
        <TextareaField label={t('awi.supervision.investigationSummary')} hint={t('awi.supervision.investigationSummaryHint')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} required data-testid="investigation-summary" />
      </div>
    </Dialog>
  );
}
