'use client';

import { GLOSSARY, PROCESS_SHORT, type ClockRule } from '@mas/domain';
import { EmptyState, KeyValue, Pill, Sheet, SheetBody, SheetHead, TabPanel, Table, TableWrap, Tabs, Term, TextField, type PillTone } from '@mas/ui';
import { useEffect, useState } from 'react';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useSelection } from '@/lib/selection';
import { useConfig } from '@/lib/store';
import styles from './Help.module.css';

const BUILD_ID = 'mockup-0.1.0';

const TABS = [
  { id: 'glossary', label: 'Glossary' },
  { id: 'shortcuts', label: 'Keyboard shortcuts' },
  { id: 'guidance', label: 'Guidance in use' },
  { id: 'about', label: 'About' },
];

const UNIT_LABELS: Record<ClockRule['unit'], string> = { 'calendar-days': 'calendar days', 'working-days': 'working days', weeks: 'weeks', months: 'months' };

const CONFIDENCE: Record<ClockRule['confidence'], { word: string; tone: PillTone; verify: boolean }> = {
  high: { word: 'High', tone: 'low', verify: false },
  verify: { word: 'Verify', tone: 'medium', verify: true },
  local: { word: 'Local', tone: 'outline', verify: true },
  advisory: { word: 'Advisory', tone: 'neutral', verify: false },
};

/** Only keys the shell actually handles. There are no global shortcuts yet. */
const KEY_GROUPS: Array<{ where: string; keys: Array<[string, string]> }> = [
  {
    where: 'Search box in the top bar',
    keys: [
      ['Down arrow', 'Highlight the next suggestion'],
      ['Up arrow', 'Highlight the previous suggestion'],
      ['Enter', 'Open the highlighted person or process, or run a full search'],
      ['Escape', 'Close the suggestions'],
    ],
  },
  {
    where: 'Tab lists (Person 360, Sharing, Help)',
    keys: [
      ['Left and Right arrows', 'Move between tabs'],
      ['Home and End', 'Jump to the first or last tab'],
    ],
  },
  {
    where: 'Lists with row links (processes, meetings, people)',
    keys: [['Enter', 'Open the focused row']],
  },
  {
    where: 'Dialogs',
    keys: [['Escape', 'Close the dialog without saving']],
  },
];

const LEGISLATION = [
  'Adult Support and Protection (Scotland) Act 2007 and Code of Practice (July 2022)',
  'National Guidance for Child Protection in Scotland 2021 (updated 2023)',
  'Children (Scotland) Act 1995',
  'Children’s Hearings (Scotland) Act 2011',
  'Children and Young People (Scotland) Act 2014',
  'UNCRC (Incorporation) (Scotland) Act 2024',
  'Children (Care and Justice) (Scotland) Act 2024',
  'Management of Offenders etc. (Scotland) Act 2005 and MAPPA National Guidance (current edition)',
  'Sexual Offences Act 2003 Part 2',
  'Adults with Incapacity (Scotland) Act 2000 and Codes of Practice',
  'Social Work (Scotland) Act 1968 s13ZA',
  'Mental Health (Care and Treatment) (Scotland) Act 2003',
  'Domestic Abuse (Scotland) Act 2018',
  'Equally Safe strategy',
  'UK GDPR, Data Protection Act 2018 (Schedule 1 Part 2 paragraph 18), Data (Use and Access) Act 2025',
  'Human Rights Act 1998',
  'Care Inspectorate Practice Guide to Chronologies (2017)',
  'Risk Management Authority Standards and Guidelines for Risk Management (FRAME)',
];

function dueLabel(rule: ClockRule): string {
  const unit = rule.amount === 1 ? UNIT_LABELS[rule.unit].replace(/s$/, '') : UNIT_LABELS[rule.unit];
  const prefix = rule.kind === 'warning' ? 'Warn at ' : '';
  return `${prefix}${rule.amount} ${unit}`;
}

export function Help() {
  const config = useConfig();
  const route = useRoute();
  const navigate = useNavigate();
  const select = useSelection((s) => s.select);
  const dev = useDevState();
  const [term, setTerm] = useState('');
  const tab = route.query.get('tab') ?? 'glossary';

  useEffect(() => {
    select(null);
  }, [select]);

  function setTab(id: string) {
    navigate(`/help${setQuery(route.query, { tab: id === 'glossary' ? null : id })}`, { replace: true });
  }

  const q = term.trim().toLowerCase();
  const entries = GLOSSARY.filter((g) => !q || g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q));

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Help</h1>
          <p className="page-lede">What the abbreviations mean, which keys work, which editions of guidance the clocks follow, and what this build is.</p>
        </div>
      </div>
      <div className={styles.tabs}>
        <Tabs items={TABS} value={tab} onChange={setTab} label="Help sections" idPrefix="help" />
      </div>

      <TabPanel id="glossary" active={tab === 'glossary'} idPrefix="help">
        <ScreenState state={dev ?? 'ready'}>
          <div className={styles.glossaryHead}>
            <div className={styles.filter}>
              <TextField label="Find a term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Type an abbreviation or a word from its meaning" />
            </div>
            <span className={styles.count} aria-live="polite">
              {entries.length === GLOSSARY.length ? `${GLOSSARY.length} terms` : `${entries.length} of ${GLOSSARY.length} terms`}
            </span>
          </div>
          {entries.length === 0 ? (
            <EmptyState title="No terms match" text="Try the abbreviation on its own, or a word from the full name." />
          ) : (
            <dl className={styles.glossary}>
              {entries.map((g) => (
                <div key={g.term} className={styles.entry}>
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
          <strong>No global shortcuts yet.</strong> The shell does not bind keys for search, the context drawer or help; each is reached with Tab in the order it appears on screen, and every control shows a visible focus ring. The keys below work inside the parts named.
        </p>
        <div className="stack">
          {KEY_GROUPS.map((group) => (
            <Sheet key={group.where}>
              <SheetHead title={group.where} headingLevel={2} />
              <SheetBody flush>
                <TableWrap label={`Keys in ${group.where}`} className={styles.flushTable}>
                  <Table>
                    <thead>
                      <tr>
                        <th scope="col">Key</th>
                        <th scope="col">What happens</th>
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
            <SheetHead title="Guidance editions in use" meta="Set in Admin. The clocks and process labels follow these editions." divided />
            <SheetBody flush>
              <TableWrap label="Guidance editions" className={styles.flushTable}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">Guidance</th>
                      <th scope="col">Edition</th>
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
            <SheetHead title="Clock rules" meta="Rules marked Verify or Local are seeded from local procedures or secondary sources and are to verify against the primary source before use." divided />
            <SheetBody flush>
              <TableWrap label="Clock rules" className={styles.flushTable}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">Rule</th>
                      <th scope="col">Process</th>
                      <th scope="col">Trigger</th>
                      <th scope="col">Due</th>
                      <th scope="col">Source</th>
                      <th scope="col">Confidence</th>
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
                          <td className={styles.nowrap}>{dueLabel(r)}</td>
                          <td className={styles.source}>
                            {r.source}
                            {r.localNote ? <span className={styles.ruleId}>{r.localNote}</span> : null}
                          </td>
                          <td>
                            <Pill size="sm" tone={c.tone}>
                              {c.word}
                            </Pill>
                            {c.verify || r.todoVerify ? <span className={styles.verify}>to verify</span> : null}
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
            <SheetHead title="Platform" meta="Working name. The product has no public name yet; the lantern and the word Platform stand in for the wordmark." divided />
            <SheetBody>
              <KeyValue
                items={[
                  { key: 'Build', value: <code className={styles.code}>{BUILD_ID}</code> },
                  { key: 'What it is', value: 'A high-fidelity, clickable desktop mockup of a multi-agency public protection platform for Scotland. No backend.' },
                  { key: 'Data', value: 'Synthetic, generated from a fixed seed. Postcodes begin with Q, V or X. CHI numbers are generated and tagged synthetic.' },
                  { key: 'Network', value: 'None. Connectors are mock adapters behind the real interface.' },
                  { key: 'Telemetry', value: 'None.' },
                ]}
              />
              <p className={styles.notice}>
                <strong>Synthetic data. No network. No telemetry. Every person, address and record is fictional.</strong> Any resemblance to a real person, family, address or case is coincidental.
              </p>
            </SheetBody>
          </Sheet>
          <Sheet>
            <SheetHead title="Legislation and guidance referenced" meta="Named in the product where a duty, a clock or a lawful basis comes from them." divided />
            <SheetBody>
              <ul className={styles.legislation}>
                {LEGISLATION.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </SheetBody>
          </Sheet>
        </div>
      </TabPanel>
    </div>
  );
}
