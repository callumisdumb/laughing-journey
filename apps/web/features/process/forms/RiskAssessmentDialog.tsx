'use client';

import { RISK_BANDS, londonToIso, riskBandLabel, riskToolLabel, type MappaProcess, type RiskAssessment, type RiskBand, type RiskTool } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';

/** The tools a MAPPA risk assessment is recorded from. The platform records the outcome; it does not run the tool. */
const TOOLS: RiskTool[] = ['rm2000', 'sa07', 'lscmi', 'other'];

/**
 * A risk assessment on a MAPPA subject: tool, date, assessor and band, as its own record with a
 * chronology milestone, then attached to the case so a referral up has something to cite. Opened
 * from the risk sheet and from the referral's refusal when the case has none.
 */
export function RiskAssessmentDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: MappaProcess }) {
  const t = useT();
  const user = useCurrentUser();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [tool, setTool] = useState<RiskTool>('rm2000');
  const [band, setBand] = useState<RiskBand>('high');
  const [date, setDate] = useState(() => now.toISOString().slice(0, 10));
  const [score, setScore] = useState('');
  const [summary, setSummary] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function submit() {
    if (!user) return;
    const by = `${user.givenName} ${user.familyName}`;
    const assessedAt = londonToIso(date, now.toISOString().slice(11, 16));
    const ra: RiskAssessment = {
      id: newId('ra'),
      synthetic: true,
      processId: process.id,
      subjectId: process.subjectIds[0]!,
      tool,
      assessedAt,
      assessorUserId: user.id,
      assessorName: by,
      assessorAgency: user.agency,
      score: score.trim() ? Number(score) : undefined,
      band,
      bandLabel: riskBandLabel(band),
      evidenceRefs: [],
    };
    const label = t('forms.mappaRisk.audit', { tool: riskToolLabel(tool), band: riskBandLabel(band) });
    // The assessment first, as its own record with the milestone a risk assessment carries
    // (docs/RECORDS.md section 3); refused, nothing else is written. Then the case, which cites it.
    const recorded = write({
      collection: 'riskAssessments',
      record: ra,
      intent: 'create',
      act: 'create',
      targetType: 'process',
      targetLabel: label,
      processId: process.id,
      event: { eventType: user.agency === 'health' ? 'health.assessment' : user.agency === 'social-work' ? 'social-work.assessment' : 'other', significance: 'high', visibility: 'agency-only', title: label, detail: summary, subjectIds: process.subjectIds, occurredAt: assessedAt, linkedProcessIds: [process.id] },
    });
    if (!recorded.ok) {
      setErrors(recorded.errors);
      return;
    }
    const attached = write({
      collection: 'processes',
      record: { ...process, riskAssessmentIds: [...process.riskAssessmentIds, ra.id], detail: { ...process.detail, riskAssessmentIds: [...process.detail.riskAssessmentIds, ra.id] } },
      intent: 'update',
      act: 'edit',
      targetType: 'process',
      targetLabel: t('forms.mappaRisk.attached', { tool: riskToolLabel(tool) }),
      processId: process.id,
      versionChange: label,
    });
    if (!attached.ok) {
      setErrors(attached.errors);
      return;
    }
    toast({ title: t('forms.mappaRisk.done.title'), text: t('forms.mappaRisk.done.text', { tool: riskToolLabel(tool), band: riskBandLabel(band) }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('forms.mappaRisk.title')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="risk-submit">
            {t('forms.mappaRisk.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p>{t('forms.mappaRisk.intro')}</p>
        <SelectField label={t('forms.mappaRisk.tool')} value={tool} onChange={(e) => setTool(e.target.value as RiskTool)} options={TOOLS.map((x) => ({ value: x, label: riskToolLabel(x) }))} data-testid="risk-tool" />
        <SelectField label={t('forms.mappaRisk.band')} value={band} onChange={(e) => setBand(e.target.value as RiskBand)} options={RISK_BANDS.filter((b) => b !== 'unknown').map((b) => ({ value: b, label: riskBandLabel(b) }))} data-testid="risk-band" />
        <DateField label={t('forms.mappaRisk.date')} value={date} onChange={setDate} required data-testid="risk-date" />
        <TextField label={t('forms.mappaRisk.score')} hint={t('forms.mappaRisk.scoreHint')} value={score} onChange={(e) => setScore(e.target.value)} inputMode="numeric" data-testid="risk-score" />
        <TextareaField label={t('forms.mappaRisk.summary')} hint={t('forms.mappaRisk.summaryHint')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} data-testid="risk-summary" />
      </div>
    </Dialog>
  );
}
