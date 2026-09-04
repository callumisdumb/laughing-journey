'use client';

import { agencyShort, formatDateTime, roleLabel } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { MOCK_ADAPTERS, setLatencyScale, setOutage, simulation } from '@mas/connectors';
import { Button, ConfirmDialog, Dialog, SelectField, Switch, TextField } from '@mas/ui';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DemoClock } from '@/components/DemoClock';
import { useAppearance } from '@/lib/appearance';
import { useNavigate } from '@/lib/router';
import { DEMO_TOOLS } from '@/lib/simulator';
import { useAppStore, useData } from '@/lib/store';
import { userName } from '@/lib/selectors';
import { WAYPOINTS } from './waypoints';
import styles from './DemoPanel.module.css';

/** Personas the script switches between, in the order it switches to them. */
const PERSONAS = ['usr_janet_kerr', 'usr_karen_findlay', 'usr_moira_gilmour', 'usr_graeme_dunlop', 'usr_mark_hepburn', 'usr_priya_sharif'];

const SPEEDS = [
  { value: '1', scale: 1 },
  { value: '0.3', scale: 0.3 },
  { value: '0', scale: 0 },
] as const;

/**
 * The demo control panel (brief section G.1).
 *
 * Hidden until Control, Shift and D, and absent from a production build, because it is not part of
 * the product and a viewer who saw it in a recording would reasonably take it for one. It says so
 * in its own subtitle for the same reason.
 *
 * Everything here exists because of something that goes wrong on a shoot. A chapter needs a persona
 * and a route and a theme and an instant, and setting those in four places mid sentence is three of
 * the eleven minutes gone, so a waypoint is one click. State drifts between takes, so reset goes
 * back to the seed and takes the clock and any break-glass grant with it. And a take that has to be
 * shot again needs the set-up back rather than the whole thing rebuilt, which is what a snapshot is.
 */
export function DemoPanel() {
  const t = useT();
  const data = useData();
  const navigate = useNavigate();
  const signIn = useAppStore((s) => s.signIn);
  const userId = useAppStore((s) => s.session.userId);
  const setDemoNow = useAppStore((s) => s.setDemoNow);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const snapshots = useAppStore((s) => s.snapshots);
  const takeSnapshot = useAppStore((s) => s.takeSnapshot);
  const restoreSnapshot = useAppStore((s) => s.restoreSnapshot);
  const deleteSnapshot = useAppStore((s) => s.deleteSnapshot);
  const setTheme = useAppearance((s) => s.setTheme);
  const setDensity = useAppearance((s) => s.setDensity);
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [name, setName] = useState('');
  const [outages, setOutages] = useState<string[]>(() => [...simulation.outage]);
  const [speed, setSpeed] = useState<string>(() => String(simulation.latencyScale));

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey || !e.shiftKey || e.key.toLowerCase() !== 'd') return;
      e.preventDefault();
      setOpen((v) => !v);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!DEMO_TOOLS || !userId) return null;

  function goTo(waypointId: string) {
    const waypoint = WAYPOINTS.find((w) => w.id === waypointId);
    if (!waypoint) return;
    setTheme(waypoint.theme);
    setDensity(waypoint.density);
    if (waypoint.nowIso) setDemoNow(waypoint.nowIso);
    // The persona before the route, so the screen is drawn once, as the right person.
    signIn(waypoint.userId, true);
    setOpen(false);
    navigate(waypoint.path);
  }

  function toggleOutage(id: string, on: boolean) {
    setOutage(id, on);
    setOutages(on ? [...outages, id] : outages.filter((x) => x !== id));
  }

  function changeSpeed(value: string) {
    setSpeed(value);
    setLatencyScale(Number(value));
  }

  return (
    <>
      {/*
        Mounted only while it is open (D-134a). A closed dialog is hidden and still in the DOM, and
        a demo panel that is in the DOM of every screen is one a test cannot prove is hidden.
      */}
      {open ? (
      <Dialog open onClose={() => setOpen(false)} title={t('demo.title')} size="lg" actions={<Button variant="secondary" onClick={() => setOpen(false)}>{t('common.actions.close')}</Button>}>
        <div className={styles.panel} data-testid="demo-panel">
          <p className={styles.lede}>
            {t('demo.subtitle')} {t('demo.shortcut')}.
          </p>

          <section className={styles.section} aria-label={t('demo.waypoints.title')}>
            <h3 className={styles.sectionTitle}>{t('demo.waypoints.title')}</h3>
            <ul className={styles.waypoints}>
              {WAYPOINTS.map((waypoint) => {
                const who = data.users.find((u) => u.id === waypoint.userId);
                return (
                  <li key={waypoint.id}>
                    <button type="button" className={styles.waypoint} onClick={() => goTo(waypoint.id)} data-testid={`waypoint-${waypoint.id}`}>
                      <span>{tKey(`demo.waypoints.${waypoint.id}`)}</span>
                      <span className={styles.waypointWho}>{who ? userName(who) : waypoint.userId}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={styles.section} aria-label={t('demo.personas.title')}>
            <h3 className={styles.sectionTitle}>{t('demo.personas.title')}</h3>
            <div className={styles.personas}>
              {PERSONAS.map((id) => {
                const who = data.users.find((u) => u.id === id);
                if (!who) return null;
                return (
                  <button key={id} type="button" className={styles.persona} data-current={id === userId ? 'true' : undefined} onClick={() => { signIn(id, true); setOpen(false); }} data-testid={`persona-${id}`}>
                    <span>{userName(who)}</span>
                    <span className={styles.personaMeta}>{t('demo.personas.meta', { role: roleLabel(who.roleId), agency: agencyShort(who.agency) })}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={styles.section} aria-label={t('demo.clock.title')}>
            <h3 className={styles.sectionTitle}>{t('demo.clock.title')}</h3>
            <DemoClock compact />
          </section>

          <section className={styles.section} aria-label={t('demo.snapshots.title')}>
            <h3 className={styles.sectionTitle}>{t('demo.snapshots.title')}</h3>
            <div className={styles.keep}>
              <TextField label={t('demo.snapshots.nameLabel')} placeholder={t('demo.snapshots.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} data-testid="snapshot-name" />
              <Button variant="secondary" disabled={name.trim().length === 0} onClick={() => { takeSnapshot(name); setName(''); }} data-testid="snapshot-keep">
                {t('demo.snapshots.keep')}
              </Button>
            </div>
            {snapshots.length === 0 ? (
              <p className={styles.empty}>{t('demo.snapshots.empty')}</p>
            ) : (
              <ul className={styles.snapshots}>
                {snapshots.map((snapshot) => (
                  <li key={snapshot.name} className={styles.snapshot}>
                    <span className={styles.snapshotName}>{snapshot.name}</span>
                    <span className={styles.snapshotWhen}>{t('demo.snapshots.taken', { when: formatDateTime(snapshot.at) })}</span>
                    <Button size="sm" variant="secondary" onClick={() => { restoreSnapshot(snapshot.name); setOpen(false); }} data-testid={`snapshot-restore-${snapshot.name}`}>
                      {t('demo.snapshots.restore', { name: snapshot.name })}
                    </Button>
                    <Button size="sm" variant="quiet" icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => deleteSnapshot(snapshot.name)}>
                      {t('demo.snapshots.delete', { name: snapshot.name })}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section} aria-label={t('demo.connectors.title')}>
            <h3 className={styles.sectionTitle}>{t('demo.connectors.title')}</h3>
            <SelectField label={t('demo.connectors.latency')} value={speed} onChange={(e) => changeSpeed(e.target.value)} options={SPEEDS.map((s) => ({ value: s.value, label: tKey(`connectors.speed.${s.scale === 0 ? 'instant' : s.scale < 1 ? 'fast' : 'realistic'}`) }))} />
            <div className={styles.connectors}>
              {MOCK_ADAPTERS.map((adapter) => (
                <Switch key={adapter.id} label={t('demo.connectors.outageLabel', { name: adapter.displayName })} checked={outages.includes(adapter.id)} onChange={(e) => toggleOutage(adapter.id, e.target.checked)} />
              ))}
            </div>
          </section>

          <section className={styles.section} aria-label={t('demo.reset.title')}>
            <h3 className={styles.sectionTitle}>{t('demo.reset.title')}</h3>
            <div className={styles.resetRow}>
              <Button variant="secondary" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={() => setConfirmReset(true)} data-testid="demo-reset">
                {t('common.actions.resetDemo')}
              </Button>
              <span className={styles.hint}>{t('demo.reset.hint')}</span>
            </div>
          </section>
        </div>
      </Dialog>
      ) : null}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetDemo();
          setConfirmReset(false);
          setOpen(false);
        }}
        title={t('demo.reset.confirmTitle')}
        confirmLabel={t('common.actions.resetDemo')}
      >
        <p>{t('demo.reset.confirmText')}</p>
      </ConfirmDialog>
    </>
  );
}
