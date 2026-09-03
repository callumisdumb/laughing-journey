'use client';

import { PROCESS_SHORT, type ClockRule } from '@mas/domain';
import { tKey, useT, type MessageKey, type Translator } from '@mas/messages';
import { EmptyState, KeyValue, Pill, Sheet, SheetBody, SheetHead, TabPanel, Table, TableWrap, Tabs, Term, TextField, type PillTone } from '@mas/ui';
import { useEffect, useState } from 'react';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useSelection } from '@/lib/selection';
import { useConfig } from '@/lib/store';
import styles from './Help.module.css';
import { glossaryEntries } from './glossary';

const BUILD_ID = 'mockup-0.1.0';

const UNIT_KEYS: Record<ClockRule['unit'], string> = { 'calendar-days': 'calendarDays', 'working-days': 'workingDays', weeks: 'weeks', months: 'months' };

const CONFIDENCE: Record<ClockRule['confidence'], { tone: PillTone; verify: boolean }> = {
  high: { tone: 'low', verify: false },
  verify: { tone: 'medium', verify: true },
  local: { tone: 'outline', verify: true },
  advisory: { tone: 'neutral', verify: false },
};

const confidenceWord = (c: ClockRule['confidence']) => tKey(`help.clockRules.confidence.${c}`);

const LEGISLATION = [
  'help.about.legislation.aspAct',
  'help.about.legislation.cpGuidance',
  'help.about.legislation.childrenAct1995',
  'help.about.legislation.hearingsAct',
  'help.about.legislation.cypAct',
  'help.about.legislation.uncrcAct',
  'help.about.legislation.careJusticeAct',
  'help.about.legislation.mappaAct',
  'help.about.legislation.sexualOffencesAct',
  'help.about.legislation.awiAct',
  'help.about.legislation.socialWorkAct',
  'help.about.legislation.mentalHealthAct',
  'help.about.legislation.domesticAbuseAct',
  'help.about.legislation.equallySafe',
  'help.about.legislation.dataProtection',
  'help.about.legislation.humanRightsAct',
  'help.about.legislation.chronologiesGuide',
  'help.about.legislation.rmaFrame',
] as const satisfies readonly MessageKey[];

/** Only keys the shell actually handles. There are no global shortcuts yet. */
function keyGroups(t: Translator): Array<{ id: string; where: string; keys: Array<[string, string]> }> {
  return [
    {
      id: 'search',
      where: t('help.shortcuts.search.where'),
      keys: [
        [t('help.shortcuts.search.downKey'), t('help.shortcuts.search.downWhat')],
        [t('help.shortcuts.search.upKey'), t('help.shortcuts.search.upWhat')],
        [t('help.shortcuts.search.enterKey'), t('help.shortcuts.search.enterWhat')],
        [t('help.shortcuts.search.escapeKey'), t('help.shortcuts.search.escapeWhat')],
      ],
    },
    {
      id: 'tabs',
      where: t('help.shortcuts.tabs.where'),
      keys: [
        [t('help.shortcuts.tabs.arrowsKey'), t('help.shortcuts.tabs.arrowsWhat')],
        [t('help.shortcuts.tabs.homeEndKey'), t('help.shortcuts.tabs.homeEndWhat')],
      ],
    },
    {
      id: 'lists',
      where: t('help.shortcuts.lists.where'),
      keys: [[t('help.shortcuts.lists.enterKey'), t('help.shortcuts.lists.enterWhat')]],
    },
    {
      id: 'dialogs',
      where: t('help.shortcuts.dialogs.where'),
      keys: [[t('help.shortcuts.dialogs.escapeKey'), t('help.shortcuts.dialogs.escapeWhat')]],
    },
  ];
}

function dueLabel(t: Translator, rule: ClockRule): string {
  const due = tKey(`common.clockUnit.${UNIT_KEYS[rule.unit]}`, { count: rule.amount });
  return rule.kind === 'warning' ? t('help.clockRules.dueWarning', { due }) : due;
}

export function Help() {
  const t = useT();
  const config = useConfig();
  const route = useRoute();
  const navigate = useNavigate();
  const select = useSelection((s) => s.select);
  const dev = useDevState();
  const [term, setTerm] = useState('');
  const tab = route.query.get('tab') ?? 'glossary';
  // Read on every render so an Admin override of a term shows at once; the component re-renders through useT().
  const glossary = glossaryEntries();

  useEffect(() => {
    select(null);
  }, [select]);

  function setTab(id: string) {
    navigate(`/help${setQuery(route.query, { tab: id === 'glossary' ? null : id })}`, { replace: true });
  }

  const tabs = [
    { id: 'glossary', label: t('help.tabs.glossary') },
    { id: 'shortcuts', label: t('help.tabs.shortcuts') },
    { id: 'guidance', label: t('help.tabs.guidance') },
    { id: 'about', label: t('help.tabs.about') },
  ];
  const q = term.trim().toLowerCase();
  const entries = glossary.filter((g) => !q || g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q));

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('help.title')}</h1>
          <p className="page-lede">{t('help.lede')}</p>
        </div>
      </div>
      <div className={styles.tabs}>
        <Tabs items={tabs} value={tab} onChange={setTab} label={t('help.tabs.label')} idPrefix="help" />
      </div>

      <TabPanel id="glossary" active={tab === 'glossary'} idPrefix="help">
        <ScreenState state={dev ?? 'ready'}>
          <div className={styles.glossaryHead}>
            <div className={styles.filter}>
              <TextField label={t('help.glossary.find')} value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('help.glossary.findPlaceholder')} />
            </div>
            <span className={styles.count} aria-live="polite">
              {entries.length === glossary.length ? t('help.glossary.countAll', { count: glossary.length }) : t('help.glossary.countFiltered', { shown: entries.length, total: glossary.length })}
            </span>
          </div>
          {entries.length === 0 ? (
            <EmptyState title={t('help.glossary.emptyTitle')} text={t('help.glossary.emptyText')} />
          ) : (
            <dl className={styles.glossary}>
              {entries.map((g) => (
                <div key={g.id} className={styles.entry}>
                  <dt>{g.term}</dt>
                  <dd>{g.definition}</dd>
                </div>
              ))}
            </dl>
          )}
        </ScreenState>
      </TabPanel>

      <TabPanel id="shortcuts" active={tab === 'shortcuts'} idPrefix="help">
        <p className={styles.intro}>
          <strong>{t('help.shortcuts.introLead')}</strong> {t('help.shortcuts.intro')}
        </p>
        <div className="stack">
          {keyGroups(t).map((group) => (
            <Sheet key={group.id}>
              <SheetHead title={group.where} headingLevel={2} />
              <SheetBody flush>
                <TableWrap label={t('help.shortcuts.tableLabel', { where: group.where })} className={styles.flushTable}>
                  <Table>
                    <thead>
                      <tr>
                        <th scope="col">{t('help.shortcuts.columnKey')}</th>
                        <th scope="col">{t('help.shortcuts.columnWhat')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.keys.map(([key, what]) => (
                        <tr key={key}>
                          <td>
                            <kbd className={styles.kbd}>{key}</kbd>
                          </td>
                          <td>{what}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </SheetBody>
            </Sheet>
          ))}
        </div>
      </TabPanel>

      <TabPanel id="guidance" active={tab === 'guidance'} idPrefix="help">
        <div className="stack">
          <Sheet>
            <SheetHead title={t('help.guidance.title')} meta={t('help.guidance.meta')} divided />
            <SheetBody flush>
              <TableWrap label={t('help.guidance.tableLabel')} className={styles.flushTable}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('help.guidance.columnGuidance')}</th>
                      <th scope="col">{t('help.guidance.columnEdition')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.guidanceEditions.map((g) => (
                      <tr key={g.id}>
                        <td>{g.label}</td>
                        <td>{g.edition}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </SheetBody>
          </Sheet>
          <Sheet>
            <SheetHead title={t('help.clockRules.title')} meta={t('help.clockRules.meta')} divided />
            <SheetBody flush>
              <TableWrap label={t('help.clockRules.tableLabel')} className={styles.flushTable}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('help.clockRules.columnRule')}</th>
                      <th scope="col">{t('help.clockRules.columnProcess')}</th>
                      <th scope="col">{t('help.clockRules.columnTrigger')}</th>
                      <th scope="col">{t('help.clockRules.columnDue')}</th>
                      <th scope="col">{t('help.clockRules.columnSource')}</th>
                      <th scope="col">{t('help.clockRules.columnConfidence')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.clockRules.map((r) => {
                      const c = CONFIDENCE[r.confidence];
                      return (
                        <tr key={r.id} data-confidence={r.confidence}>
                          <td>
                            {r.label}
                            <span className={styles.ruleId}>{r.id}</span>
                          </td>
                          <td>
                            <Term term={PROCESS_SHORT[r.process]} />
                          </td>
                          <td>{r.trigger}</td>
                          <td className={styles.nowrap}>{dueLabel(t, r)}</td>
                          <td className={styles.source}>
                            {r.source}
                            {r.localNote ? <span className={styles.ruleId}>{r.localNote}</span> : null}
                          </td>
                          <td>
                            <Pill size="sm" tone={c.tone}>
                              {confidenceWord(r.confidence)}
                            </Pill>
                            {c.verify || r.todoVerify ? <span className={styles.verify}>{t('help.clockRules.toVerify')}</span> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </SheetBody>
          </Sheet>
        </div>
      </TabPanel>

      <TabPanel id="about" active={tab === 'about'} idPrefix="help">
        <div className="stack">
          <Sheet>
            <SheetHead title={t('common.app.name')} meta={t('help.about.meta')} divided />
            <SheetBody>
              <KeyValue
                items={[
                  { key: t('help.about.facts.build'), value: <code className={styles.code}>{BUILD_ID}</code> },
                  { key: t('help.about.facts.whatIs'), value: t('help.about.facts.whatIsText') },
                  { key: t('help.about.facts.data'), value: t('help.about.facts.dataText') },
                  { key: t('help.about.facts.network'), value: t('help.about.facts.networkText') },
                  { key: t('help.about.facts.telemetry'), value: t('help.about.facts.telemetryText') },
                ]}
              />
              <p className={styles.notice}>
                <strong>{t('help.about.noticeLead')}</strong> {t('help.about.notice')}
              </p>
            </SheetBody>
          </Sheet>
          <Sheet>
            <SheetHead title={t('help.about.legislationTitle')} meta={t('help.about.legislationMeta')} divided />
            <SheetBody>
              <ul className={styles.legislation}>
                {LEGISLATION.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            </SheetBody>
          </Sheet>
        </div>
      </TabPanel>
    </div>
  );
}
