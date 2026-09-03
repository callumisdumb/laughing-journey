'use client';

import { useT } from '@mas/messages';
import { EmptyState, ProcessMark, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { useEffect } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { useRoute } from '@/lib/router';
import { useSelection } from '@/lib/selection';
import { useNow } from '@/lib/store';
import { isReportKind, reportCatalogue } from './model';
import { resolvePeriod } from './period';
import { ReportAsp } from './ReportAsp';
import { ReportAwi } from './ReportAwi';
import { ReportCp } from './ReportCp';
import { ReportMappa } from './ReportMappa';
import { ReportMarac } from './ReportMarac';
import { NmdsExport } from './NmdsExport';
import { ReportPrintPack } from './ReportPrintPack';
import styles from './Reports.module.css';

function ReportsIndex() {
  const t = useT();
  const now = useNow();
  const dev = useDevState();
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('reports.index.title')}</h1>
          <p className="page-lede">{t('reports.index.lede')}</p>
        </div>
      </div>
      <ScreenState state={dev ?? 'ready'} empty={{ title: t('reports.index.emptyTitle'), text: t('reports.index.emptyText') }}>
        <ul className={styles.cards}>
          {reportCatalogue().map((r) => {
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
                      <dt>{t('reports.index.recipient')}</dt>
                      <dd>{r.recipient}</dd>
                      <dt>{t('reports.index.period')}</dt>
                      <dd>{t('reports.index.opens', { periodLabel: r.periodLabel, period: period.label })}</dd>
                    </dl>
                    <AppLink href={`/reports/${r.kind}`} className={styles.cardLink}>
                      {t('reports.index.open', { title: r.title })}
                    </AppLink>
                  </SheetBody>
                </Sheet>
              </li>
            );
          })}
        </ul>
      </ScreenState>
      <p className={styles.footnote}>{t('reports.index.footnote')}</p>
    </div>
  );
}

function ReportNotFound({ kind }: { kind: string }) {
  const t = useT();
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('reports.notFound.title')}</h1>
          <p className="page-lede">{t('reports.notFound.lede', { kind })}</p>
        </div>
      </div>
      <EmptyState title={t('reports.notFound.emptyTitle')} text={t('reports.notFound.emptyText')} actions={<AppLink href="/reports">{t('reports.frame.allReports')}</AppLink>} />
    </div>
  );
}

/** Route table for /reports and /reports/<kind>, including the ?print=1 pack and the ?nmds=1 return. */
export function Reports({ kind }: { kind?: string }) {
  const route = useRoute();
  const select = useSelection((s) => s.select);

  useEffect(() => {
    select(null);
  }, [select]);

  if (!kind) return <ReportsIndex />;
  if (!isReportKind(kind)) return <ReportNotFound kind={kind} />;
  if (route.query.get('print') === '1') return <ReportPrintPack kind={kind} />;
  if (kind === 'asp' && route.query.get('nmds') === '1') return <NmdsExport />;
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
