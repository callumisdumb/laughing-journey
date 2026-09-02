'use client';

import { AGENCY_SHORT, CLASSIFICATION_LABELS, EVENT_FAMILY_LABELS, eventFamily, formatDate, formatDateTime } from '@mas/domain';
import { Button, ClassificationBanner } from '@mas/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from '@/lib/router';
import { chronologyPath } from '@/lib/routes';
import { currentAddress, fullName } from '@/lib/selectors';
import { useAppStore, useData, useNow } from '@/lib/store';
import { useChronology } from './useChronology';
import styles from './PrintPack.module.css';

const ROWS_PER_PAGE = 18;

/** The chronology as a paginated print pack with classification marking, header and footer on every page. */
export function PrintPack({ personId }: { personId: string }) {
  const data = useData();
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
  const classification = processes.some((p) => p.classification === 'restricted') ? 'restricted' : 'official-sensitive';
  const reference = processes.map((p) => p.reference).join(', ') || 'No open process';
  const bases = data.lawfulBases.filter((b) => events.some((e) => e.lawfulBasisId === b.id));
  const totalPages = pages.length + 1;

  const head = (page: number) => (
    <div className={styles.head}>
      <span>
        {CLASSIFICATION_LABELS[classification]}. {reference}
      </span>
      <span>
        {fullName(person)}, born {person.dateOfBirth ? formatDate(person.dateOfBirth) : 'not recorded'}
      </span>
      <span>
        Page {page} of {totalPages}
      </span>
    </div>
  );
  const foot = (
    <div className={styles.foot}>
      <span>Printed {formatDateTime(now)} from the platform. Synthetic demonstration data.</span>
      <span>{CLASSIFICATION_LABELS[classification]}</span>
    </div>
  );

  return (
    <div className={`${styles.pack} print-pack`}>
      <div className={`${styles.controls} no-print`}>
        <Button variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => navigate(chronologyPath(personId))}>
          Back to chronology
        </Button>
        <Button variant="primary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <ClassificationBanner level={classification} />
      <section className={`${styles.page} print-page`}>
        {head(1)}
        <h1 className={styles.title}>Integrated chronology: {fullName(person)}</h1>
        <div className={styles.meta}>
          <div>Date of birth: {person.dateOfBirth ? formatDate(person.dateOfBirth) : 'not recorded'}. CHI (synthetic): {person.chi ?? 'none'}.</div>
          <div>Address: {currentAddress(data, person).line}.</div>
          <div>Processes: {reference}.</div>
          <div>
            Window: {formatDate(model.domain.from)} to {formatDate(model.domain.to)}. {events.length} events. View: {model.visible.length === events.length ? 'unfiltered' : 'filtered'}.
          </div>
          <div>Compiled for: {processes[0] ? `${processes[0].title}` : 'general record'}. Contains only events judged relevant, necessary and proportionate for that purpose (Care Inspectorate Practice Guide to Chronologies, 2017).</div>
        </div>
        <h2>Lawful basis for the integrated events</h2>
        {bases.length === 0 ? <p>No integrated events in this pack.</p> : null}
        {bases.map((b) => (
          <p key={b.id} style={{ fontSize: 'var(--text-sm)', maxWidth: 'none' }}>
            <strong>{b.purpose}.</strong> {b.article6}; {b.article9Condition}; {b.article10Criminal !== 'not applicable' ? `${b.article10Criminal}; ` : ''}
            {b.statutoryGateway.join('; ')}. {b.necessityAndProportionality} Authorised by {b.authorisedByName}.
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
                <th scope="col">Date</th>
                <th scope="col">Agency</th>
                <th scope="col">Type</th>
                <th scope="col">Event</th>
                <th scope="col">Response and outcome</th>
                <th scope="col">Significance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.hasTime ? formatDateTime(e.occurredAt) : formatDate(e.occurredAt)}
                    {e.approximate ? ' (approx.)' : ''}
                  </td>
                  <td>{AGENCY_SHORT[e.agency]}</td>
                  <td>{EVENT_FAMILY_LABELS[eventFamily(e.eventType)]}</td>
                  <td>
                    <strong>{e.title}</strong>
                    <br />
                    {e.detail}
                  </td>
                  <td>
                    {e.response ?? ''}
                    {e.outcome ? ` Outcome: ${e.outcome}` : ''}
                  </td>
                  <td>
                    {e.significance}
                    {e.significanceReason ? `: ${e.significanceReason}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {i === pages.length - 1 && model.analyses.length > 0 ? (
            <div className={styles.analysis}>
              <h3>Analysis (professional judgement, kept separate from the facts above)</h3>
              {model.analyses.map((a) => (
                <p key={a.id} style={{ fontSize: 'var(--text-sm)', maxWidth: 'none', marginBottom: 6 }}>
                  <strong>{a.title}</strong> ({a.kind}; {a.authorName}, {AGENCY_SHORT[a.agency]}, {formatDate(a.recordedAt)}). {a.text}
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
