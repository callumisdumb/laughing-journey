'use client';

import { DEFAULT_CONFIG, type Config, type Dataset } from '@mas/domain';
import { Button, Dialog, Sheet, SheetBody, SheetHead, TextField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppLink } from '@/components/AppLink';
import { useAppStore, useData } from '@/lib/store';
import styles from './Overview.module.css';
import { SectionHead } from './SectionHead';
import { ADMIN_SECTIONS, type AdminSectionId } from './sections';
import { useAdminConfig } from './useAdminConfig';

const areaSchema = z.object({
  councilName: z.string().trim().min(2, 'Enter the council name'),
  hscpName: z.string().trim().min(2, 'Enter the HSCP name'),
  healthBoardName: z.string().trim().min(2, 'Enter the health board name'),
  policeDivision: z.string().trim().min(2, 'Enter the police division'),
  ppuBase: z.string().trim().min(2, 'Enter the Public Protection Unit base'),
  maracArea: z.string().trim().min(2, 'Enter the MARAC area'),
  sheriffCourt: z.string().trim().min(2, 'Enter the sheriff court'),
});
type AreaValues = z.infer<typeof areaSchema>;

const AREA_FIELDS: Array<{ name: keyof AreaValues; label: string }> = [
  { name: 'councilName', label: 'Council' },
  { name: 'hscpName', label: 'Health and Social Care Partnership' },
  { name: 'healthBoardName', label: 'Health board' },
  { name: 'policeDivision', label: 'Police division' },
  { name: 'ppuBase', label: 'Public Protection Unit base' },
  { name: 'maracArea', label: 'MARAC area' },
  { name: 'sheriffCourt', label: 'Sheriff court' },
];

function sectionCounts(config: Config, data: Dataset): Record<AdminSectionId, string> {
  const toVerify = config.clockRules.filter((r) => r.confidence !== 'high' || r.todoVerify).length;
  const changedLabels = Object.entries(config.labels).filter(([k, v]) => DEFAULT_CONFIG.labels[k] !== v).length;
  const processes = new Set(config.forms.map((f) => f.process)).size;
  return {
    labels: `${Object.keys(config.labels).length} labels, ${changedLabels} changed from the default`,
    timescales: `${config.clockRules.length} clock rules, ${toVerify} to verify`,
    forms: `${config.forms.length} forms across ${processes} processes`,
    'need-to-know': `${config.needToKnow.length} audience rows, ${config.exclusions.length} exclusions`,
    agencies: `${data.organisations.length} organisations, ${data.teams.length} teams`,
    users: `${data.users.length} personas`,
    markings: `${config.classificationMarkings.length} markings`,
    defaults: `Theme ${config.defaults.theme}, density ${config.defaults.density}, break-glass ${config.breakGlassHours} hours, ${config.bankHolidays.length} bank holidays`,
  };
}

export function Overview() {
  const { config, canEdit, save } = useAdminConfig();
  const data = useData();
  const resetDemo = useAppStore((s) => s.resetDemo);
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const form = useForm<AreaValues>({ resolver: zodResolver(areaSchema), defaultValues: config.area });
  const errors = form.formState.errors;
  const counts = sectionCounts(config, data);

  function submit(values: AreaValues) {
    const result = save({ ...config, area: values }, 'overview', `Area details: ${values.councilName}`);
    setSaveErrors(result.errors);
    if (result.ok) form.reset(values);
  }

  function confirmReset() {
    resetDemo();
    audit({ act: 'edit', targetType: 'config', targetId: 'reset', targetLabel: 'Demo data reset to the seed' });
    setResetOpen(false);
    form.reset(DEFAULT_CONFIG.area);
    toast({ title: 'Demo data reset', text: 'Records, configuration and local changes are back to the seed. You are still signed in.', tone: 'success' });
  }

  return (
    <>
      <SectionHead
        title="Admin"
        lede="Local configuration for this area: names, timescales, forms, need-to-know, agencies, personas, markings and defaults. Every change is validated and audited."
        actions={
          <Button variant="danger" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={() => setResetOpen(true)}>
            Reset demo data
          </Button>
        }
      />
      <div className="stack">
        <Sheet>
          <SheetHead title="Area details" meta="Shown in headers, packs and the sign-in screen. Fictional names only." />
          <SheetBody>
            <form className={styles.areaForm} onSubmit={(e) => e.preventDefault()} noValidate>
              {AREA_FIELDS.map((f) => (
                <TextField key={f.name} label={f.label} required disabled={!canEdit} maxLength={80} {...form.register(f.name)} error={errors[f.name]?.message} />
              ))}
              {saveErrors.length > 0 ? (
                <ul className={styles.errors} role="alert">
                  {saveErrors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.formActions}>
                <Button variant="primary" disabled={!canEdit || !form.formState.isDirty} onClick={() => void form.handleSubmit(submit)()}>
                  Save area details
                </Button>
                <Button variant="quiet" disabled={!form.formState.isDirty} onClick={() => form.reset(config.area)}>
                  Discard changes
                </Button>
              </div>
            </form>
          </SheetBody>
        </Sheet>

        <section aria-labelledby="admin-sections-heading">
          <h2 id="admin-sections-heading" className={styles.sectionsHeading}>
            Sections
          </h2>
          <div className={styles.cards}>
            {ADMIN_SECTIONS.map((s) => (
              <article key={s.id} className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <AppLink href={`/admin/${s.id}`}>{s.label}</AppLink>
                </h3>
                <p className={styles.cardText}>{s.description}</p>
                <p className={styles.cardCount}>{counts[s.id]}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      {resetOpen ? (
        <Dialog
          open
          onClose={() => setResetOpen(false)}
          title="Reset the demo data?"
          actions={
            <>
              <Button variant="quiet" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmReset}>
                Reset demo data
              </Button>
            </>
          }
        >
          <p>Every change made on this device is discarded: records, meetings, actions, configuration and the local audit entries return to the seed. Your sign-in is kept.</p>
        </Dialog>
      ) : null}
    </>
  );
}
