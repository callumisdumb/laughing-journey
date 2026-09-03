'use client';

import { EmptyState, ProcessMark, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { useEffect } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { useRoute } from '@/lib/router';
import { useSelection } from '@/lib/selection';
import { useNow } from '@/lib/store';
import { REPORT_CATALOGUE, isReportKind } from './model';
import { resolvePeriod } from './period';
import { ReportAsp } from './ReportAsp';
import { ReportAwi } from './ReportAwi';
import { ReportCp } from './ReportCp';
import { ReportMappa } from './ReportMappa';
import { ReportMarac } from './ReportMarac';
import { ReportPrintPack } from './ReportPrintPack';
import styles from './Reports.module.css';

function ReportsIndex() {
  const now = useNow();
  const dev = useDevState();
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Reports</h1>
          <p className="page-lede">Inspection-ready figures computed from the record store as it stands: one report per protection process, each with a print pack. Nothing here is typed in, so every number traces back to a record.</p>
        </div>
      </div>
      <ScreenState state={dev ?? 'ready'} empty={{ title: 'No reports available', text: 'Reports are generated from the record store. Reset the demo data from Settings if the store is empty.' }}>
        <ul className={styles.cards}>
          {REPORT_CATALOGUE.map((r) => {
            const period = resolvePeriod(r.kind, now, null);
            return (
              <li key={r.kind} className={styles.cardItem}>
                <Sheet as="article" className={styles.card}>
                  <SheetHead
                    title={
                      <span className={styles.cardTitle}>
                        <ProcessMark type={r.kind} /> {r.title}
                      </span>
                    }
                  />
                  <SheetBody className={styles.cardBody}>
                    <p className={styles.purpose}>{r.purpose}</p>
                    <dl className={styles.cardMeta}>
                      <dt>Who receives it</dt>
                      <dd>{r.recipient}</dd>
                      <dt>Period</dt>
                      <dd>
                        {r.periodLabel}. Opens on {period.label}.
                      </dd>
                    </dl>
                    <AppLink href={`/reports/${r.kind}`} className={styles.cardLink}>
                      Open {r.title}
                    </AppLink>
                  </SheetBody>
                </Sheet>
              </li>
            );
          })}
        </ul>
      </ScreenState>
      <p className={styles.footnote}>The dataset behind this demonstration holds eight worked scenarios and a background population, so every count is small. Counts are never padded and a period with nothing in it shows zeros.</p>
    </div>
  );
}

function ReportNotFound({ kind }: { kind: string }) {
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Report not found</h1>
          <p className="page-lede">There is no report called {kind}.</p>
        </div>
      </div>
      <EmptyState title="Choose a report from the list" text="The five reports are ASP biennial figures, Child Protection Register statistics, the MARAC SafeLives return, MAPPA annual report counts and AWI application timeliness." actions={<AppLink href="/reports">All reports</AppLink>} />
    </div>
  );
}

/** Route table for /reports and /reports/<kind>, including the ?print=1 pack. */
export function Reports({ kind }: { kind?: string }) {
  const route = useRoute();
  const select = useSelection((s) => s.select);

  useEffect(() => {
    select(null);
  }, [select]);

  if (!kind) return <ReportsIndex />;
  if (!isReportKind(kind)) return <ReportNotFound kind={kind} />;
  if (route.query.get('print') === '1') return <ReportPrintPack kind={kind} />;
  switch (kind) {
    case 'asp':
      return <ReportAsp />;
    case 'cp':
      return <ReportCp />;
    case 'marac':
      return <ReportMarac />;
    case 'mappa':
      return <ReportMappa />;
    case 'awi':
      return <ReportAwi />;
  }
}
