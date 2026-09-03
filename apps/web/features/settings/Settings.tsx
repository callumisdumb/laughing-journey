'use client';

import { AGENCY_LABELS, DEMO_NOW_ISO, ROLE_DEFINITIONS, formatDateTime } from '@mas/domain';
import { AgencyMark, Button, Dialog, KeyValue, RadioGroup, Sheet, SheetBody, SheetHead, Switch, useToast } from '@mas/ui';
import { useEffect, useState } from 'react';
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

const PREF_ITEMS: Array<{ key: keyof NotificationPrefs; label: string; hint: string }> = [
  { key: 'clocksDueThisWeek', label: 'Clocks due this week', hint: 'A summary of statutory clocks on your cases that fall due in the next seven days.' },
  { key: 'newShares', label: 'New shares to me', hint: 'When another agency shares something with you, with the reason they did.' },
  { key: 'meetingInvites', label: 'Meeting invites', hint: 'Invitations, pre-meeting report requests and distributed minutes.' },
  { key: 'connectorInbox', label: 'Connector inbox items', hint: 'New events from your agency’s systems waiting for review.' },
];

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
    audit({ act: 'edit', targetType: 'config', targetId: 'demo-reset', targetLabel: 'Demo data reset to the seed', reason: 'Every local change discarded; the eight scenarios regenerated from the seed' });
    toast({ title: 'Demo data reset', text: 'The eight scenarios are back exactly as shipped. Your sign-in and appearance are unchanged.', tone: 'success' });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Settings</h1>
          <p className="page-lede">Appearance and notification preferences are kept on this device. The demo clock and the reset control live here too. Nothing is sent anywhere.</p>
        </div>
      </div>

      <div className={styles.grid}>
        <Sheet>
          <SheetHead title="Appearance" meta="Both themes and both densities are designed. Pick what suits the room." divided />
          <SheetBody>
            <div className={styles.appearance}>
              <RadioGroup
                legend="Theme"
                name="theme"
                value={theme}
                onChange={(v) => setTheme(v as ThemePreference)}
                orientation="horizontal"
                options={[
                  { value: 'light', label: 'Light', hint: 'Cream paper, warm ink.' },
                  { value: 'dark', label: 'Dark', hint: 'Peat paper for dim rooms.' },
                  { value: 'system', label: 'Match this device', hint: 'Follows the operating system.' },
                ]}
              />
              <RadioGroup
                legend="Density"
                name="density"
                value={density}
                onChange={(v) => setDensity(v as Density)}
                orientation="horizontal"
                options={[
                  { value: 'comfortable', label: 'Comfortable', hint: '40 px rows.' },
                  { value: 'compact', label: 'Compact', hint: '32 px rows for long lists.' },
                ]}
              />
            </div>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title="Notifications" meta="Demo preferences, stored on this device only." divided />
          <SheetBody>
            <div className={styles.prefs}>
              {PREF_ITEMS.map((item) => (
                <div key={item.key} className={styles.pref}>
                  <Switch label={item.label} checked={prefs[item.key]} onChange={(e) => setPref(item.key, e.target.checked)} />
                  <span className={styles.prefHint}>{item.hint}</span>
                </div>
              ))}
            </div>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title="Demo clock" meta="Every clock, due date and overdue marker is calculated from this instant." divided />
          <SheetBody>
            <Switch label="Live clock" checked={liveClock} onChange={(e) => setLiveClock(e.target.checked)} />
            <p className={styles.clockNow}>
              The demo is frozen at <strong>{formatDateTime(DEMO_NOW_ISO)}</strong> unless the live clock is on. Right now the product thinks it is <strong>{formatDateTime(now)}</strong>.
            </p>
            <p className={styles.note}>Turn the live clock on to watch clocks tick over in a long demo. Turn it off to get the scenarios back to their designed state.</p>
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title="Signed in as" meta="The persona switcher in the top bar changes who you are. This is a demo; there is no real sign-in." divided />
          <SheetBody>
            <KeyValue
              items={[
                { key: 'Name', value: `${user.givenName} ${user.familyName}` },
                { key: 'Role', value: ROLE_DEFINITIONS[user.roleId].label },
                { key: 'Agency', value: <AgencyMark agency={user.agency} label={AGENCY_LABELS[user.agency]} /> },
                { key: 'Organisation', value: organisation ? organisation.name : user.organisationId },
                { key: 'Team', value: team ? team.name : 'None' },
                { key: 'Base', value: user.base },
              ]}
            />
            <p className={styles.note}>Use the persona switcher (marked Demo) to see the same records as a different role. Each switch is written to the audit log.</p>
          </SheetBody>
        </Sheet>

        <Sheet tone="paper" className={styles.wide}>
          <SheetHead title="Demo data" meta="Everything you change in the demo is kept on this device until you reset it." divided />
          <SheetBody>
            <div className={styles.danger}>
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                Reset demo data
              </Button>
              <span className={styles.note}>Discards every local change and regenerates the eight scenarios from the seed. Sign-in and appearance are kept.</span>
            </div>
          </SheetBody>
        </Sheet>
      </div>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        actions={
          <>
            <Button variant="quiet" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doReset}>
              Reset demo data
            </Button>
          </>
        }
      >
        <p>This removes every change made on this device since the seed: events, minutes, shares, promoted inbox items and audit entries you added. The eight scenarios come back exactly as shipped. Your sign-in and appearance are kept.</p>
      </Dialog>
    </div>
  );
}
