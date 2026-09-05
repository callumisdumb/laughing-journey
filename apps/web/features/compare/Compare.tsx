'use client';

import { agencyShort, detailLevelLabel, processLabel, roleLabel } from '@mas/domain';
import { useT } from '@mas/messages';
import { Pill, SelectField, Switch } from '@mas/ui';
import { Lock } from 'lucide-react';
import { toBase64Url } from '@mas/crypto';
import { useEffect } from 'react';
import { ProcessScreen } from '@/features/process/ProcessScreen';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useSelection } from '@/lib/selection';
import { accessForUser, userName } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useGrants, useNow, useVault } from '@/lib/store';
import { ViewAs } from '@/lib/viewAs';
import styles from './Compare.module.css';

/**
 * One panel: a persona's header and the real record screen drawn for them.
 *
 * The grants are deliberately not the session's unless the panel is set to the signed-in user. A
 * break-glass grant is recorded against a process and a moment rather than against a person, so
 * passing the session's grants into a panel set to somebody else would open the record for a
 * persona who never took one, and the view would be demonstrating the opposite of its claim.
 */
function Panel({ userId, processId, side }: { userId: string; processId: string; side: 'left' | 'right' }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const signedIn = useCurrentUser();
  const grants = useGrants();
  const who = data.users.find((u) => u.id === userId);
  const target = data.processes.find((p) => p.id === processId);
  if (!who || !target) return null;
  const access = accessForUser(data, config, who, target, userId === signedIn?.id ? grants : [], now);
  return (
    <section className={styles.panel} aria-label={userName(who)} data-testid={`compare-${side}-panel`}>
      <header className={styles.panelHead}>
        <span className={styles.panelWho}>{userName(who)}</span>
        <span className={styles.panelRole}>
          {roleLabel(who.roleId)}, {agencyShort(who.agency)}
        </span>
        <span className={styles.panelAccess}>
          {access.level === 'none' ? (
            <Pill tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
              {t('compare.panel.restricted')}
            </Pill>
          ) : (
            <Pill tone={access.level === 'full' ? 'accent' : 'outline'} size="sm">
              {t('compare.panel.access', { level: detailLevelLabel(access.level) })}
            </Pill>
          )}
        </span>
      </header>
      <div className={styles.panelBody}>
        <ViewAs userId={userId}>
          <ProcessScreen processId={processId} />
        </ViewAs>
      </div>
    </section>
  );
}

/**
 * Two people, one record, one window (brief section G.3).
 *
 * Everything else this product says about need-to-know is an assertion the audience is asked to
 * take on trust. Two panels showing the same case, one open and one refusing by name, is a
 * demonstration, and it is the most persuasive thing here.
 *
 * The panels are the real `ProcessScreen`, drawn inside a `ViewAs` provider rather than a second
 * component that renders what the rules would say. A summary would be an assertion too, and worse:
 * it would be an assertion that could drift from the screens it claims to describe. What makes this
 * work is that the rules are already computed per user, so a screen given a different reader
 * answers differently without knowing why it was asked.
 *
 * The third panel is the hosting provider. Practitioner, partner agency and hosting provider in one
 * frame is the whole security argument in a single still.
 */
export function Compare() {
  const t = useT();
  const route = useRoute();
  const navigate = useNavigate();
  const data = useData();
  const user = useCurrentUser();
  const vault = useVault();
  const select = useSelection((s) => s.select);

  useEffect(() => {
    select(null);
  }, [select]);

  const processId = route.query.get('process') ?? 'prc_marac_docherty';
  const leftId = route.query.get('left') ?? 'usr_karen_findlay';
  // Not the housing officer the brief names as the example, because in this seed housing is a MARAC
  // agency and Mark Hepburn is on the case: the default would have been two identical panels, which
  // is the worst possible default for the one screen whose whole point is the difference. Graeme
  // Dunlop is a mental health officer with presence only on it.
  const rightId = route.query.get('right') ?? 'usr_graeme_dunlop';
  const showHost = route.query.get('host') === '1';

  const process = data.processes.find((p) => p.id === processId);
  const left = data.users.find((u) => u.id === leftId);
  const right = data.users.find((u) => u.id === rightId);

  function set(key: string, value: string | null) {
    navigate(`/compare${setQuery(route.query, { [key]: value })}`, { replace: true });
  }

  if (!user || !process || !left || !right) return null;

  const record = vault.records.get(process.id);
  const columns = showHost ? 3 : 2;

  return (
    <div className={`page ${styles.page}`}>
      <div>
        <div className="page-head">
          <div className="page-head-text">
            <h1>{t('compare.title')}</h1>
            <p className="page-lede">{t('compare.lede')}</p>
          </div>
        </div>
        <div className={styles.controls}>
          <SelectField
            label={t('compare.controls.record')}
            value={processId}
            onChange={(e) => set('process', e.target.value)}
            options={data.processes.filter((p) => p.status === 'open').map((p) => ({ value: p.id, label: `${p.reference} (${processLabel(p.type)})` }))}
            data-testid="compare-record"
          />
          <SelectField label={t('compare.controls.left')} value={leftId} onChange={(e) => set('left', e.target.value)} options={data.users.map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)}` }))} data-testid="compare-left" />
          <SelectField label={t('compare.controls.right')} value={rightId} onChange={(e) => set('right', e.target.value)} options={data.users.map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)}` }))} data-testid="compare-right" />
          <Switch label={t('compare.controls.host')} checked={showHost} onChange={(e) => set('host', e.target.checked ? '1' : null)} />
        </div>
      </div>

      <div className={styles.panels} style={{ ['--compare-columns' as string]: String(columns) }}>
        <Panel userId={leftId} processId={processId} side="left" />
        <Panel userId={rightId} processId={processId} side="right" />
        {showHost ? (
          <section className={styles.panel} aria-label={t('compare.host.title')} data-testid="compare-host">
            <header className={styles.panelHead}>
              <span className={styles.panelWho}>{t('compare.host.title')}</span>
              <span className={styles.panelRole}>{record ? t('compare.host.holders', { count: record.wrappedKeys.length }) : ''}</span>
            </header>
            <div className={styles.host}>
              <p className={styles.hostLede}>{t('compare.host.lede')}</p>
              {record ? (
                <>
                  <div className={styles.hostRow}>
                    <span className={styles.hostKey}>{t('admin.serverView.columns.id')}</span>
                    <span className={styles.hostValue}>{record.metadata.id}</span>
                    <span className={styles.hostKey}>{t('admin.serverView.columns.type')}</span>
                    <span className={styles.hostValue}>{record.metadata.type}</span>
                    <span className={styles.hostKey}>{t('admin.serverView.columns.classification')}</span>
                    <span className={styles.hostValue}>{record.metadata.classification}</span>
                    <span className={styles.hostKey}>{t('admin.serverView.columns.updatedAt')}</span>
                    <span className={styles.hostValue}>{record.metadata.updatedAt}</span>
                    <span className={styles.hostKey}>{t('admin.serverView.columns.ciphertext')}</span>
                    <span className={styles.hostValue}>{toBase64Url(record.sealed.ciphertext).slice(0, 220)}</span>
                  </div>
                  <p className={styles.hostLede}>{t('compare.host.bytes', { count: record.sealed.ciphertext.length })}</p>
                </>
              ) : (
                <p className={styles.hostLede}>{t('compare.host.missing')}</p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
