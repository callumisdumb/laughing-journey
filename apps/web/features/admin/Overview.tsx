'use client';

import { MESSAGE_KEYS, sessionOverrides, useT, type Translator } from '@mas/messages';
import { DEFAULT_CONFIG, type Config, type Dataset } from '@mas/domain';
import { Button, Dialog, Sheet, SheetBody, SheetHead, TextField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppLink } from '@/components/AppLink';
import { useAppStore, useData } from '@/lib/store';
import styles from './Overview.module.css';
import { SectionHead } from './SectionHead';
import { ADMIN_SECTIONS, sectionDescription, sectionLabel, type AdminSectionId } from './sections';
import { useAdminConfig } from './useAdminConfig';

function areaSchema(t: Translator) {
  return z.object({
    councilName: z.string().trim().min(2, t('admin.overview.areaErrors.councilName')),
    hscpName: z.string().trim().min(2, t('admin.overview.areaErrors.hscpName')),
    healthBoardName: z.string().trim().min(2, t('admin.overview.areaErrors.healthBoardName')),
    policeDivision: z.string().trim().min(2, t('admin.overview.areaErrors.policeDivision')),
    ppuBase: z.string().trim().min(2, t('admin.overview.areaErrors.ppuBase')),
    maracArea: z.string().trim().min(2, t('admin.overview.areaErrors.maracArea')),
    sheriffCourt: z.string().trim().min(2, t('admin.overview.areaErrors.sheriffCourt')),
  });
}
type AreaValues = z.infer<ReturnType<typeof areaSchema>>;

const AREA_FIELDS = [
  { name: 'councilName', label: 'admin.overview.areaFields.councilName' },
  { name: 'hscpName', label: 'admin.overview.areaFields.hscpName' },
  { name: 'healthBoardName', label: 'admin.overview.areaFields.healthBoardName' },
  { name: 'policeDivision', label: 'admin.overview.areaFields.policeDivision' },
  { name: 'ppuBase', label: 'admin.overview.areaFields.ppuBase' },
  { name: 'maracArea', label: 'admin.overview.areaFields.maracArea' },
  { name: 'sheriffCourt', label: 'admin.overview.areaFields.sheriffCourt' },
] as const satisfies ReadonlyArray<{ name: keyof AreaValues; label: string }>;

function sectionCounts(config: Config, data: Dataset, t: Translator): Record<AdminSectionId, string> {
  const toVerify = config.clockRules.filter((r) => r.confidence !== 'high' || r.todoVerify).length;
  const processes = new Set(config.forms.map((f) => f.process)).size;
  return {
    labels: t('admin.copy.overviewCount', { total: MESSAGE_KEYS.length, changed: Object.keys(sessionOverrides()).length }),
    timescales: t('admin.overview.counts.timescales', { count: config.clockRules.length, toVerify }),
    forms: t('admin.overview.counts.forms', { count: config.forms.length, processes }),
    'need-to-know': t('admin.overview.counts.needToKnow', { rows: config.needToKnow.length, exclusions: config.exclusions.length }),
    agencies: t('admin.overview.counts.agencies', { organisations: data.organisations.length, teams: data.teams.length }),
    users: t('admin.overview.counts.users', { count: data.users.length }),
    markings: t('admin.overview.counts.markings', { count: config.classificationMarkings.length }),
    'server-view': t('admin.overview.counts.serverView', { records: data.processes.length }),
    'audit-chain': t('admin.overview.counts.auditChain', { entries: data.audit.length }),
    disclosure: t('admin.overview.counts.disclosure', { threshold: 2, holders: 5 }),
    defaults: t('admin.overview.counts.defaults', { theme: config.defaults.theme, density: config.defaults.density, hours: config.breakGlassHours, bankHolidays: config.bankHolidays.length }),
  };
}

export function Overview() {
  const t = useT();
  const { config, canEdit, save } = useAdminConfig();
  const data = useData();
  const resetDemo = useAppStore((s) => s.resetDemo);
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const schema = useMemo(() => areaSchema(t), [t]);
  const form = useForm<AreaValues>({ resolver: zodResolver(schema), defaultValues: config.area });
  const errors = form.formState.errors;
  const counts = sectionCounts(config, data, t);

  function submit(values: AreaValues) {
    const result = save({ ...config, area: values }, 'overview', t('admin.overview.area.audit', { council: values.councilName }));
    setSaveErrors(result.errors);
    if (result.ok) form.reset(values);
  }

  function confirmReset() {
    resetDemo();
    audit({ act: 'edit', targetType: 'config', targetId: 'reset', targetLabel: t('common.demoReset.audit') });
    setResetOpen(false);
    form.reset(DEFAULT_CONFIG.area);
    toast({ title: t('common.demoReset.toastTitle'), text: t('admin.overview.reset.toastText'), tone: 'success' });
  }

  return (
    <>
      <SectionHead
        title={t('admin.title')}
        lede={t('admin.overview.lede')}
        actions={
          <Button variant="danger" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={() => setResetOpen(true)}>
            {t('common.actions.resetDemo')}
          </Button>
        }
      />
      <div className="stack">
        <Sheet>
          <SheetHead title={t('admin.overview.area.title')} meta={t('admin.overview.area.meta')} />
          <SheetBody>
            <form className={styles.areaForm} onSubmit={(e) => e.preventDefault()} noValidate>
              {AREA_FIELDS.map((f) => (
                <TextField key={f.name} label={t(f.label)} required disabled={!canEdit} maxLength={80} {...form.register(f.name)} error={errors[f.name]?.message} />
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
                  {t('admin.overview.area.save')}
                </Button>
                <Button variant="quiet" disabled={!form.formState.isDirty} onClick={() => form.reset(config.area)}>
                  {t('admin.actions.discardChanges')}
                </Button>
              </div>
            </form>
          </SheetBody>
        </Sheet>

        <section aria-labelledby="admin-sections-heading">
          <h2 id="admin-sections-heading" className={styles.sectionsHeading}>
            {t('admin.overview.sectionsHeading')}
          </h2>
          <div className={styles.cards}>
            {ADMIN_SECTIONS.map((s) => (
              <article key={s.id} className={styles.card}>
                <h3 className={styles.cardTitle}>
                  <AppLink href={`/admin/${s.id}`}>{sectionLabel(s.id)}</AppLink>
                </h3>
                <p className={styles.cardText}>{sectionDescription(s.id)}</p>
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
          title={t('admin.overview.reset.dialogTitle')}
          actions={
            <>
              <Button variant="quiet" onClick={() => setResetOpen(false)}>
                {t('common.actions.cancel')}
              </Button>
              <Button variant="danger" onClick={confirmReset}>
                {t('common.actions.resetDemo')}
              </Button>
            </>
          }
        >
          <p>{t('admin.overview.reset.dialogText')}</p>
        </Dialog>
      ) : null}
    </>
  );
}
