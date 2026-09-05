'use client';

import { agencyLabel, roleLabel } from '@mas/domain';
import { useT, type MessageKey } from '@mas/messages';
import { AgencyMark, Button, ConfirmDialog, KeyValue, RadioGroup, Sheet, SheetBody, SheetHead, Switch, useToast } from '@mas/ui';
import { useEffect, useState } from 'react';
import { useAppearance, type Density, type ThemePreference } from '@/lib/appearance';
import { useSelection } from '@/lib/selection';
import { useAppStore, useCurrentUser, useData } from '@/lib/store';
import styles from './Settings.module.css';
import { DemoClock } from '@/components/DemoClock';

const NOTIFICATIONS_KEY = 'mas.notifications';

interface NotificationPrefs {
  clocksDueThisWeek: boolean;
  newShares: boolean;
  meetingInvites: boolean;
  connectorInbox: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = { clocksDueThisWeek: true, newShares: true, meetingInvites: true, connectorInbox: true };

const PREF_ITEMS = [
  { key: 'clocksDueThisWeek', label: 'settings.notifications.clocksDueThisWeek.label', hint: 'settings.notifications.clocksDueThisWeek.hint' },
  { key: 'newShares', label: 'settings.notifications.newShares.label', hint: 'settings.notifications.newShares.hint' },
  { key: 'meetingInvites', label: 'settings.notifications.meetingInvites.label', hint: 'settings.notifications.meetingInvites.hint' },
  { key: 'connectorInbox', label: 'settings.notifications.connectorInbox.label', hint: 'settings.notifications.connectorInbox.hint' },
] as const satisfies ReadonlyArray<{ key: keyof NotificationPrefs; label: MessageKey; hint: MessageKey }>;

/** A message whose arguments are rendered elements (the bold date-times); the tag form waits on typed tag arguments. */

function readPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof NotificationPrefs, unknown>>;
    const out = { ...DEFAULT_PREFS };
    for (const item of PREF_ITEMS) {
      const v = parsed[item.key];
      if (typeof v === 'boolean') out[item.key] = v;
    }
    return out;
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePrefs(prefs: NotificationPrefs): void {
  try {
    window.localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable: the switches still work for this visit */
  }
}

export function Settings() {
  const t = useT();
  const user = useCurrentUser();
  const data = useData();
  const theme = useAppearance((s) => s.theme);
  const density = useAppearance((s) => s.density);
  const setTheme = useAppearance((s) => s.setTheme);
  const setDensity = useAppearance((s) => s.setDensity);
  const recording = useAppearance((s) => s.recording);
  const setRecording = useAppearance((s) => s.setRecording);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const audit = useAppStore((s) => s.audit);
  const select = useSelection((s) => s.select);
  const { toast } = useToast();
  // AppRoot only mounts screens after the store is ready on the client, so localStorage is safe to read here.
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => readPrefs());
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  const organisation = data.organisations.find((o) => o.id === user.organisationId);
  const team = data.teams.find((t) => t.id === user.teamId);

  function setPref(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    writePrefs(next);
  }

  function doReset() {
    resetDemo();
    setConfirmReset(false);
    audit({ act: 'edit', targetType: 'config', targetId: 'demo-reset', targetLabel: t('common.demoReset.audit'), reason: t('settings.reset.auditReason') });
    toast({ title: t('common.demoReset.toastTitle'), text: t('settings.reset.toastText'), tone: 'success' });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('settings.title')}</h1>
          <p className="page-lede">{t('settings.lede')}</p>
        </div>
      </div>

      <div className={styles.grid}>
        <Sheet>
          <SheetHead title={t('settings.appearance.title')} meta={t('settings.appearance.meta')} divided />
          <SheetBody>
            <div className={styles.appearance}>
              <RadioGroup
                legend={t('settings.appearance.themeLegend')}
                name="theme"
                value={theme}
                onChange={(v) => setTheme(v as ThemePreference)}
                orientation="horizontal"
                options={[
                  { value: 'light', label: t('settings.appearance.theme.light'), hint: t('settings.appearance.themeHint.light') },
                  { value: 'dark', label: t('settings.appearance.theme.dark'), hint: t('settings.appearance.themeHint.dark') },
                  { value: 'system', label: t('settings.appearance.theme.system'), hint: t('settings.appearance.themeHint.system') },
                ]}
              />
              <RadioGroup
                legend={t('settings.appearance.densityLegend')}
                name="density"
                value={density}
                onChange={(v) => setDensity(v as Density)}
                orientation="horizontal"
                options={[
                  { value: 'comfortable', label: t('settings.appearance.density.comfortable'), hint: t('settings.appearance.densityHint.comfortable') },
                  { value: 'compact', label: t('settings.appearance.density.compact'), hint: t('settings.appearance.densityHint.compact') },
                ]}
              />
              <div className={styles.pref}>
                <Switch label={t('settings.appearance.recording')} checked={recording} onChange={(e) => setRecording(e.target.checked)} data-testid="recording-preset" />
                <span className={styles.prefHint}>{t('settings.appearance.recordingHint')}</span>
              </div>
            </div>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('settings.notifications.title')} meta={t('settings.notifications.meta')} divided />
          <SheetBody>
            <div className={styles.prefs}>
              {PREF_ITEMS.map((item) => (
                <div key={item.key} className={styles.pref}>
                  <Switch label={t(item.label)} checked={prefs[item.key]} onChange={(e) => setPref(item.key, e.target.checked)} />
                  <span className={styles.prefHint}>{t(item.hint)}</span>
                </div>
              ))}
            </div>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('settings.clock.title')} meta={t('settings.clock.meta')} divided />
          <SheetBody>
            <DemoClock />
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('settings.signedIn.title')} meta={t('settings.signedIn.meta')} divided />
          <SheetBody>
            <KeyValue
              items={[
                { key: t('settings.signedIn.name'), value: `${user.givenName} ${user.familyName}` },
                { key: t('settings.signedIn.role'), value: roleLabel(user.roleId) },
                { key: t('settings.signedIn.agency'), value: <AgencyMark agency={user.agency} label={agencyLabel(user.agency)} /> },
                { key: t('settings.signedIn.organisation'), value: organisation ? organisation.name : user.organisationId },
                { key: t('settings.signedIn.team'), value: team ? team.name : t('settings.signedIn.noTeam') },
                { key: t('settings.signedIn.base'), value: user.base },
              ]}
            />
            <p className={styles.note}>{t('settings.signedIn.note')}</p>
          </SheetBody>
        </Sheet>

        <Sheet tone="paper" className={styles.wide}>
          <SheetHead title={t('settings.demoData.title')} meta={t('settings.demoData.meta')} divided />
          <SheetBody>
            <div className={styles.danger}>
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                {t('common.actions.resetDemo')}
              </Button>
              <span className={styles.note}>{t('settings.demoData.note')}</span>
            </div>
          </SheetBody>
        </Sheet>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={doReset}
        title={t('settings.reset.dialogTitle')}
        confirmLabel={t('common.actions.resetDemo')}
      >
        <p>{t('settings.reset.dialogText')}</p>
      </ConfirmDialog>
    </div>
  );
}
