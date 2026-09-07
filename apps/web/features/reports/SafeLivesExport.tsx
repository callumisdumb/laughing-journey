'use client';

import { SAFELIVES_COLUMNS, SAFELIVES_NOT_HELD, classify, formatDate, markingFilePrefix, safeLivesCellMap, safeLivesChecks, safeLivesColumnHeader, safeLivesColumnLetter, safeLivesRowValue } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, EmptyState, Pill, SelectField, Sheet, SheetBody, SheetHead, Table, TableWrap, useToast } from '@mas/ui';
import { AlertTriangle, Check, Download, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { useAppStore, useConfig, useData, useNow } from '@/lib/store';
import styles from './SafeLivesExport.module.css';
import { safeLivesFileName, safeLivesQuarters, safeLivesRows } from './safeLivesFigures';
import { fillSafeLivesTemplate, type SafeLivesFillResult } from './safeLivesWriter';

/**
 * The SafeLives MARAC data return: one row per meeting held in the quarter, previewed cell by cell,
 * checked, and then written into a copy of the Scotland template the coordinator chooses from disk.
 *
 * Preview first and file second, for the reason the ASP return is: a return to a national body is
 * not generated and sent unseen. The template is chosen rather than bundled, because SafeLives
 * publishes it and revises it, the product makes no network calls, and the writer's header check is
 * only worth having if it runs against the file actually handed over.
 */
export function SafeLivesExport() {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const quarters = useMemo(() => safeLivesQuarters(now), [now]);
  const [quarterId, setQuarterId] = useState(quarters[0]?.id ?? '');
  const quarter = quarters.find((q) => q.id === quarterId) ?? quarters[0]!;
  const [result, setResult] = useState<SafeLivesFillResult | undefined>();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const figures = useMemo(() => safeLivesRows(data, config, quarter), [data, config, quarter]);
  const rows = useMemo(() => figures.map((f) => f.row), [figures]);
  const cells = useMemo(() => safeLivesCellMap(rows), [rows]);
  const checks = useMemo(() => figures.flatMap((f) => safeLivesChecks(f.row).map((c) => ({ ...c, date: f.date, key: `${f.meeting.id}-${c.id}` }))), [figures]);
  const failures = checks.filter((c) => c.state === 'fail');

  async function chooseTemplate(file: File) {
    setBusy(true);
    try {
      const filled = await fillSafeLivesTemplate(await file.arrayBuffer(), rows);
      setResult(filled);
      if (filled.error) {
        toast({ title: t('reports.safeLives.refused.title'), text: t(`reports.safeLives.refused.${filled.error === 'no-sheet' ? 'noSheet' : filled.error === 'not-empty' ? 'notEmpty' : filled.error}` as const), tone: 'error' });
        return;
      }
      audit({
        act: 'export',
        targetType: 'report',
        targetId: `safelives-${quarter.id}`,
        targetLabel: t('reports.safeLives.audit', { quarter: quarter.label, rows: rows.length, cells: filled.written.length }),
        restricted: false,
      });
      toast({ title: t('reports.safeLives.filled.title'), text: t('reports.safeLives.filled.text', { rows: rows.length, cells: filled.written.length }), tone: 'success' });
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!result?.file) return;
    // Aggregate counts per meeting that name nobody: routine Official, so no marking in the name (D-058).
    const { classification } = classify({ artefact: 'aggregate-report' });
    const name = `${markingFilePrefix(classification)}${safeLivesFileName(quarter, config.area.maracArea)}`;
    const url = URL.createObjectURL(result.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('reports.safeLives.title')}</h1>
          <p className="page-lede">{t('reports.safeLives.lede')}</p>
        </div>
      </div>

      <div className={styles.controls}>
        <SelectField
          label={t('reports.safeLives.quarterLabel')}
          value={quarter.id}
          onChange={(e) => {
            setQuarterId(e.target.value);
            setResult(undefined);
          }}
          options={quarters.map((q) => ({ value: q.id, label: q.label }))}
        />
        <AppLink href="/reports/marac" className={styles.back}>
          {t('reports.safeLives.backToReport')}
        </AppLink>
      </div>

      <p className={styles.meta} data-testid="safelives-meta">
        {t('reports.safeLives.meta', { maracName: config.area.maracArea, from: formatDate(quarter.from), to: formatDate(quarter.to), count: figures.length })} {t('reports.safeLives.classification')}
      </p>

      <Sheet>
        <SheetHead title={t('reports.safeLives.checksTitle')} meta={t('reports.safeLives.checksMeta')} headingLevel={2} />
        <SheetBody>
          {checks.length === 0 ? (
            <p className={styles.note}>{t('reports.safeLives.checksNone')}</p>
          ) : (
            <ul className={styles.checks} data-testid="safelives-checks">
              {checks.map((c) => (
                <li key={c.key} data-state={c.state}>
                  {c.state === 'pass' ? <Check size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
                  <span className={styles.checkLabel}>{t('reports.safeLives.checkRow', { date: formatDate(c.date), label: t(`reports.safeLives.checks.${c.id}` as const) })}</span>
                  <Pill size="sm" tone={c.state === 'pass' ? 'low' : 'critical'}>
                    {t(`reports.safeLives.checkStates.${c.state}` as const)}
                  </Pill>
                  <span className={styles.checkDetail}>{t('reports.safeLives.checkDetail', { counted: c.counted, expected: c.expected })}</span>
                </li>
              ))}
            </ul>
          )}
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('reports.safeLives.blankTitle')} meta={t('reports.safeLives.blankMeta', { count: SAFELIVES_NOT_HELD.length })} headingLevel={2} />
        <SheetBody>
          <p className={styles.note}>{t('reports.safeLives.blankText')}</p>
          <ul className={styles.blankList} data-testid="safelives-blank">
            {SAFELIVES_NOT_HELD.map((column) => (
              <li key={column}>
                {safeLivesColumnLetter(column)}: {safeLivesColumnHeader(column)}
              </li>
            ))}
          </ul>
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead
          title={t('reports.safeLives.templateTitle')}
          meta={t('reports.safeLives.templateMeta', { rows: rows.length, cells: cells.length })}
          headingLevel={2}
          actions={
            <>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx"
                aria-label={t('reports.safeLives.chooseTemplate')}
                tabIndex={-1}
                className="visually-hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) void chooseTemplate(chosen);
                }}
              />
              <Button variant="secondary" icon={<Upload size={16} aria-hidden="true" />} disabled={busy || rows.length === 0} onClick={() => fileInput.current?.click()} data-testid="safelives-choose">
                {t('reports.safeLives.chooseTemplate')}
              </Button>
              <Button variant="primary" icon={<Download size={16} aria-hidden="true" />} disabled={!result?.file} onClick={save}>
                {t('reports.safeLives.save')}
              </Button>
            </>
          }
        />
        <SheetBody>
          <p className={styles.note}>{t('reports.safeLives.templateNote')}</p>
          {failures.length > 0 ? <p className={styles.warning} role="status">{t('reports.safeLives.failuresWarning', { count: failures.length })}</p> : null}
          {result?.error === 'headers' ? (
            <div className={styles.refused} role="status">
              <p>{t('reports.safeLives.headersTitle', { count: result.headerMismatches.length })}</p>
              <ul>
                {result.headerMismatches.map((m) => (
                  <li key={m.cell}>{t('reports.safeLives.headersRow', { cell: m.cell, expected: m.expected, found: m.found })}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </SheetBody>
      </Sheet>

      {figures.length === 0 ? (
        <EmptyState title={t('reports.safeLives.emptyTitle')} text={t('reports.safeLives.emptyText')} />
      ) : (
        figures.map((f, i) => (
          <Sheet key={f.meeting.id} data-testid={`safelives-row-${i + 2}`}>
            <SheetHead title={t('reports.safeLives.rowTitle', { row: i + 2, date: formatDate(f.date), title: f.meeting.title })} meta={t('reports.safeLives.rowMeta', { count: f.references.length, references: f.references.join(', ') })} headingLevel={2} />
            <SheetBody>
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('reports.safeLives.preview.column')}</th>
                      <th scope="col">{t('reports.safeLives.preview.cell')}</th>
                      <th scope="col">{t('reports.safeLives.preview.value')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SAFELIVES_COLUMNS.map((column) => {
                      const value = safeLivesRowValue(f.row, column);
                      return (
                        <tr key={column}>
                          <th scope="row">{safeLivesColumnHeader(column)}</th>
                          <td className={styles.cellRef}>
                            {safeLivesColumnLetter(column)}
                            {i + 2}
                          </td>
                          {value === undefined ? <td className={styles.blank}>{t('reports.safeLives.blankCell')}</td> : <td className={styles.numeric}>{column === 'meetingDate' ? formatDate(String(value)) : value}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            </SheetBody>
          </Sheet>
        ))
      )}
    </div>
  );
}
