'use client';

import { agencyShort, analysisKindLabel, marking as markingFor, classificationFor, eventFamily, eventFamilyLabel, formatDate, formatDateTime, significanceLabel } from '@mas/domain';
import { useT, type RichValues } from '@mas/messages';
import { Button, ClassificationMarking } from '@mas/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from '@/lib/router';
import { chronologyPath } from '@/lib/routes';
import { currentAddress, fullName } from '@/lib/selectors';
import { useAppStore, useConfig, useData, useNow } from '@/lib/store';
import { useChronology } from './useChronology';
import styles from './PrintPack.module.css';

const ROWS_PER_PAGE = 18;

/** Argument bag for t.rich, typed so a React node (the bold lead-in of an entry) can fill an argument. */
const rich = (values: RichValues): RichValues => values;

/** The chronology as a paginated print pack with classification marking, header and footer on every page. */
export function PrintPack({ personId }: { personId: string }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const audit = useAppStore((s) => s.audit);
  const navigate = useNavigate();
  const model = useChronology(personId);
  const person = model.person;

  useEffect(() => {
    if (person) audit({ act: 'export', targetType: 'person', targetId: personId, targetLabel: `Chronology pack: ${fullName(person)}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  if (!person) return null;
  const events = [...model.events].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
  const pages: (typeof events)[] = [];
  for (let i = 0; i < events.length; i += ROWS_PER_PAGE) pages.push(events.slice(i, i + ROWS_PER_PAGE));
  if (pages.length === 0) pages.push([]);
  const processes = model.processes.filter((p) => p.status === 'open');
  // A chronology names a person and carries case detail, so it is Official-Sensitive; a restricted
  // process among the open ones adds the distribution-list handling instruction.
  const packClassification = classificationFor(config, processes.some((p) => p.classification === 'restricted') ? 'restricted' : 'official-sensitive');
  const marking = markingFor(packClassification) ?? '';
  const reference = processes.map((p) => p.reference).join(', ') || t('print.chronology.noOpenProcess');
  const bases = data.lawfulBases.filter((b) => events.some((e) => e.lawfulBasisId === b.id));
  const totalPages = pages.length + 1;
  const dateOfBirth = person.dateOfBirth ? formatDate(person.dateOfBirth) : t('common.values.notRecorded');

  const head = (page: number) => (
    <div className={styles.head}>
      <span>{marking ? t('print.common.runningHead', { classification: marking, reference }) : reference}</span>
      <span>{t('print.common.subjectHead', { name: fullName(person), date: dateOfBirth })}</span>
      <span>{t('print.common.page', { page, total: totalPages })}</span>
    </div>
  );
  const foot = (
    <div className={styles.foot}>
      <span>{t('print.common.printedFooter', { when: formatDateTime(now) })}</span>
      <span>{marking}</span>
    </div>
  );

  return (
    <div className={`${styles.pack} print-pack`}>
      <div className={`${styles.controls} no-print`}>
        <Button variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => navigate(chronologyPath(personId))}>
          {t('print.chronology.back')}
        </Button>
        <Button variant="primary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()}>
          {t('print.common.print')}
        </Button>
      </div>
      <ClassificationMarking classification={packClassification} />
      <section className={`${styles.page} print-page`}>
        {head(1)}
        <h1 className={styles.title}>{t('print.chronology.title', { name: fullName(person) })}</h1>
        <div className={styles.meta}>
          <div>{t('print.chronology.meta.dob', { date: dateOfBirth, chi: person.chi ?? t('common.values.none') })}</div>
          <div>{t('print.chronology.meta.address', { address: currentAddress(data, person).line })}</div>
          <div>{t('print.chronology.meta.processes', { reference })}</div>
          <div>{t('print.chronology.meta.window', { from: formatDate(model.domain.from), to: formatDate(model.domain.to), count: events.length, filtered: model.visible.length === events.length ? 'no' : 'yes' })}</div>
          <div>{t('print.chronology.meta.compiledFor', { purpose: processes[0]?.title ?? t('print.chronology.meta.generalRecord') })}</div>
        </div>
        <h2>{t('print.chronology.lawfulBasis.title')}</h2>
        {bases.length === 0 ? <p>{t('print.chronology.lawfulBasis.none')}</p> : null}
        {bases.map((b) => (
          <p key={b.id} style={{ fontSize: 'var(--text-sm)', maxWidth: 'none' }}>
            {t.rich('print.chronology.lawfulBasis.entry', rich({ purpose: <strong>{b.purpose}.</strong>, article6: b.article6, article9: b.article9Condition, article10: b.article10Criminal !== 'not applicable' ? `${b.article10Criminal}; ` : '', gateways: b.statutoryGateway.join('; '), necessity: b.necessityAndProportionality, author: b.authorisedByName }))}
          </p>
        ))}
        {foot}
      </section>
      {pages.map((rows, i) => (
        <section key={i} className={`${styles.page} print-page`}>
          {head(i + 2)}
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('print.chronology.columns.date')}</th>
                <th scope="col">{t('print.chronology.columns.agency')}</th>
                <th scope="col">{t('print.chronology.columns.type')}</th>
                <th scope="col">{t('print.chronology.columns.event')}</th>
                <th scope="col">{t('print.chronology.columns.responseOutcome')}</th>
                <th scope="col">{t('print.chronology.columns.significance')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.hasTime ? formatDateTime(e.occurredAt) : formatDate(e.occurredAt)}
                    {e.approximate ? ` ${t('print.chronology.approximate')}` : ''}
                  </td>
                  <td>{agencyShort(e.agency)}</td>
                  <td>{eventFamilyLabel(eventFamily(e.eventType))}</td>
                  <td>
                    <strong>{e.title}</strong>
                    <br />
                    {e.detail}
                  </td>
                  <td>
                    {e.response ?? ''}
                    {e.outcome ? ` ${t('print.chronology.outcome', { outcome: e.outcome })}` : ''}
                  </td>
                  <td>
                    {significanceLabel(e.significance)}
                    {e.significanceReason ? `: ${e.significanceReason}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {i === pages.length - 1 && model.analyses.length > 0 ? (
            <div className={styles.analysis}>
              <h3>{t('print.chronology.analysis.title')}</h3>
              {model.analyses.map((a) => (
                <p key={a.id} style={{ fontSize: 'var(--text-sm)', maxWidth: 'none', marginBottom: 6 }}>
                  {t.rich('print.chronology.analysis.entry', rich({ title: <strong>{a.title}</strong>, kind: analysisKindLabel(a.kind), author: a.authorName, agency: agencyShort(a.agency), date: formatDate(a.recordedAt), text: a.text }))}
                </p>
              ))}
            </div>
          ) : null}
          {foot}
        </section>
      ))}
    </div>
  );
}
