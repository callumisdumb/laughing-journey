'use client';

import { AGENCY_LABELS, DEMO_NOW_ISO, ROLE_DEFINITIONS, formatDateTime } from '@mas/domain';
import { formatRich, useT, type MessageKey, type Translator } from '@mas/messages';
import { AgencyMark, Button, Dialog, KeyValue, RadioGroup, Sheet, SheetBody, SheetHead, Switch, useToast } from '@mas/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useAppearance, type Density, type ThemePreference } from '@/lib/appearance';
import { useSelection } from '@/lib/selection';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './Settings.module.css';

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
function richLine(t: Translator, key: MessageKey, values: Record<string, ReactNode>): ReactNode {
  return formatRich<ReactNode>(t.raw(key) ?? key, values).map((part, i) => (typeof part === 'string' ? part : <span key={i}>{part}</span>));
}

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
  const now = useNow();
  const theme = useAppearance((s) => s.theme);
  const density = useAppearance((s) => s.density);
  const setTheme = useAppearance((s) => s.setTheme);
  const setDensity = useAppearance((s) => s.setDensity);
  const liveClock = useAppStore((s) => s.session.liveClock);
  const setLiveClock = useAppStore((s) => s.setLiveClock);
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
            <Switch label={t('settings.clock.live')} checked={liveClock} onChange={(e) => setLiveClock(e.target.checked)} />
            <p className={styles.clockNow}>{richLine(t, 'settings.clock.frozen', { frozen: <strong>{formatDateTime(DEMO_NOW_ISO)}</strong>, now: <strong>{formatDateTime(now)}</strong> })}</p>
            <p className={styles.note}>{t('settings.clock.note')}</p>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('settings.signedIn.title')} meta={t('settings.signedIn.meta')} divided />
          <SheetBody>
            <KeyValue
              items={[
                { key: t('settings.signedIn.name'), value: `${user.givenName} ${user.familyName}` },
                { key: t('settings.signedIn.role'), value: ROLE_DEFINITIONS[user.roleId].label },
                { key: t('settings.signedIn.agency'), value: <AgencyMark agency={user.agency} label={AGENCY_LABELS[user.agency]} /> },
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

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('settings.reset.dialogTitle')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setConfirmReset(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="danger" onClick={doReset}>
              {t('common.actions.resetDemo')}
            </Button>
          </>
        }
      >
        <p>{t('settings.reset.dialogText')}</p>
      </Dialog>
    </div>
  );
}
