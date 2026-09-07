'use client';

import { formatDateTime } from '@mas/domain';
import { MOCK_ADAPTERS } from '@mas/connectors';
import { useT } from '@mas/messages';
import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { DEMO_TOOLS, useSimulator, type SimEpisode } from '@/lib/simulator';
import { useAppStore, useData, useNow } from '@/lib/store';
import styles from './Simulator.module.css';

/**
 * A deliberately plain mock of a partner system.
 *
 * You cannot film two-way integration without showing the other side, and a viewer must never be
 * confused about which window they are looking at. So this is built to look like a different
 * product: plainer, denser, older, with a menu bar it does not need, square corners, a status bar,
 * and a table that puts surnames first the way these systems do. The contrast is the point.
 *
 * It has a neutral name. "Council social work system (simulated)" is not a claim about any vendor,
 * and putting a vendor's name on this screen would be one.
 *
 * The wiring is real, which is what makes it useful rather than a screenshot. Creating an episode
 * here writes an inbound change into the platform's queue, so switching back and accepting it opens
 * the process with its clocks running. Editing one changes what this system holds, so the divergence
 * appears on the platform's reconciliation screen, computed by the same function that would compute
 * it against a live feed.
 *
 * It is a demo affordance and does not belong in a production build (D-166).
 */
export function Simulator() {
  const t = useT();
  const data = useData();
  const now = useNow();
  const navigate = useNavigate();
  const episodes = useSimulator((s) => s.episodes);
  const save = useSimulator((s) => s.save);
  const add = useSimulator((s) => s.add);
  const reset = useSimulator((s) => s.reset);
  const receive = useAppStore((s) => s.receive);
  const newId = useAppStore((s) => s.newId);

  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');

  if (!DEMO_TOOLS) {
    return (
      <main className={styles.chrome} data-app-ready="true">
        <p className={styles.refusal}>{t('simulator.notInThisBuild')}</p>
      </main>
    );
  }

  const episode = episodes.find((e) => e.id === selected) ?? null;

  function open(next: SimEpisode) {
    setSelected(next.id);
    setDraft({ ...next.fields });
    setCreating(false);
    setNotice('');
  }

  function commit() {
    if (!episode) return;
    save({ ...episode, fields: { ...draft } });
    setNotice(t('simulator.saved', { reference: episode.reference }));
  }

  /**
   * A new episode, typed here, which is the half of the demo the audience has not seen.
   *
   * It writes an inbound change into the platform's queue rather than a process, because that is
   * what a change feed delivers: a case opened over here is a proposal over there until somebody
   * accepts it. The reference is this system's own, and it is what the two records are linked by.
   */
  function create(personId: string) {
    const person = data.people.find((p) => p.id === personId);
    if (!person) return;
    const reference = `ECL-EP-${now.getFullYear()}-${String(5000 + episodes.length).slice(-4)}`;
    const displayName = `${person.familyName.toUpperCase()}, ${person.givenName}`;
    const fields: Record<string, string> = {
      'Episode.Type': 'ASP',
      'Episode.OpenedDate': now.toISOString().slice(0, 10),
      'Episode.Stage': 'inquiry',
      'Episode.AllocatedWorker': t('simulator.dutyTeam'),
      'Episode.CaseReference': reference,
      'Client.Name': `${person.givenName} ${person.familyName}`,
      ...(person.dateOfBirth ? { 'Client.DateOfBirth': person.dateOfBirth } : {}),
    };
    add({ id: newId('sim'), connectorId: 'eclipse', personId, displayName, reference, fields, fromPlatform: false, sentAt: now.toISOString() });
    // The platform's side of this is the connector delivery path, not a person's write: the change
    // is what this system said, and it waits for somebody over there to accept or decline it.
    receive({
      id: newId('inb'),
      synthetic: true,
      connectorId: 'eclipse',
      kind: 'process-proposal',
      receivedAt: now.toISOString(),
      externalRef: reference,
      subjectPersonId: personId,
      subjectHint: { displayName, dateOfBirth: person.dateOfBirth, externalId: reference },
      payload: Object.entries(fields).map(([field, value]) => ({ field, value, from: 'ECLIPSE' })),
      status: 'pending',
    });
    setCreating(false);
    setNotice(t('simulator.created', { reference }));
  }

  return (
    <main className={styles.chrome} data-testid="simulator" data-app-ready="true">
      <div className={styles.menubar}>
        <span className={styles.appName}>{t('simulator.name')}</span>
        <span>{t('simulator.menu.file')}</span>
        <span>{t('simulator.menu.edit')}</span>
        <span>{t('simulator.menu.view')}</span>
        <span>{t('simulator.menu.help')}</span>
        <button type="button" className={styles.back} onClick={() => navigate('/connectors?adapter=eclipse&tab=inbound')} data-testid="simulator-back">
          {t('simulator.back')}
        </button>
      </div>

      <div className={styles.banner}>{t('simulator.banner')}</div>

      <div className={styles.body}>
        <section className={styles.list} aria-labelledby="sim-list-head">
          <div className={styles.sectionHead}>
            <h1 id="sim-list-head">{t('simulator.episodes')}</h1>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                setCreating(true);
                setSelected(null);
                setNotice('');
              }}
              data-testid="simulator-new"
            >
              {t('simulator.newEpisode')}
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => {
                reset();
                setSelected(null);
                setNotice(t('simulator.reset'));
              }}
              data-testid="simulator-reset"
            >
              {t('simulator.resetAction')}
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('simulator.columns.reference')}</th>
                <th scope="col">{t('simulator.columns.client')}</th>
                <th scope="col">{t('simulator.columns.type')}</th>
                <th scope="col">{t('simulator.columns.stage')}</th>
                <th scope="col">{t('simulator.columns.opened')}</th>
                <th scope="col">{t('simulator.columns.origin')}</th>
              </tr>
            </thead>
            <tbody>
              {episodes.length === 0 ? (
                <tr>
                  <td colSpan={6}>{t('simulator.noEpisodes')}</td>
                </tr>
              ) : null}
              {episodes.map((e) => (
                <tr key={e.id} data-selected={e.id === selected ? 'true' : undefined} data-testid={`sim-episode-${e.reference}`}>
                  <td className={styles.mono}>
                    <button type="button" className={styles.linkButton} onClick={() => open(e)} data-testid={`sim-open-${e.reference}`}>
                      {e.reference}
                    </button>
                  </td>
                  <td>{e.displayName}</td>
                  <td>{e.fields['Episode.Type'] ?? ''}</td>
                  <td>{e.fields['Episode.Stage'] ?? ''}</td>
                  <td className={styles.mono}>{e.fields['Episode.OpenedDate'] ?? ''}</td>
                  <td>{e.fromPlatform ? t('simulator.origin.platform') : t('simulator.origin.local')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.record} aria-labelledby="sim-record-head">
          <div className={styles.sectionHead}>
            <h2 id="sim-record-head">{creating ? t('simulator.newEpisode') : episode ? t('simulator.record', { reference: episode.reference }) : t('simulator.nothingSelected')}</h2>
          </div>

          {creating ? (
            <div className={styles.form} data-testid="simulator-create">
              <p className={styles.help}>{t('simulator.createHelp')}</p>
              <ul className={styles.people}>
                {data.people.slice(0, 12).map((p) => (
                  <li key={p.id}>
                    <button type="button" className={styles.linkButton} onClick={() => create(p.id)} data-testid={`sim-create-${p.id}`}>
                      {p.familyName.toUpperCase()}, {p.givenName}
                      {p.dateOfBirth ? ` (${p.dateOfBirth})` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : episode ? (
            <div className={styles.form} data-testid="simulator-record">
              {Object.keys(draft).map((field) => (
                <label key={field} className={styles.field}>
                  <span className={styles.fieldName}>{field}</span>
                  <input className={styles.input} value={draft[field] ?? ''} onChange={(ev) => setDraft({ ...draft, [field]: ev.target.value })} data-testid={`sim-field-${field}`} />
                </label>
              ))}
              <div className={styles.formActions}>
                <button type="button" className={styles.button} onClick={commit} data-testid="simulator-save">
                  {t('simulator.save')}
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.help}>{t('simulator.selectHelp')}</p>
          )}
        </section>
      </div>

      <div className={styles.statusbar} role="status">
        <span>{notice || t('simulator.ready')}</span>
        <span className={styles.statusRight}>
          {t('simulator.connected', { system: MOCK_ADAPTERS.find((a) => a.id === 'eclipse')?.systemName ?? '' })} {formatDateTime(now.toISOString())}
        </span>
      </div>
    </main>
  );
}
