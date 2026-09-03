'use client';

import {
  ASP_AGE_BANDS,
  ASP_CLIENT_GROUPS,
  ASP_ETHNICITIES,
  ASP_GENDERS,
  ASP_HARM_LOCATIONS,
  ASP_INQUIRY_ACTIONS,
  ASP_REFERRAL_SOURCES,
  HARM_TYPES,
  LSI_SERVICE_TYPES,
  NMDS_QUARTERS,
  NMDS_SHEETS,
  aspAgeBandLabel,
  aspClientGroupLabel,
  aspEthnicityLabel,
  aspGenderLabel,
  aspHarmLocationLabel,
  aspInquiryActionLabel,
  aspReferralSourceLabel,
  formatDate,
  harmTypeLabel,
  lsiServiceTypeLabel,
  classify,
  markingFilePrefix,
  nmdsCellMap,
  type NmdsCell,
  type NmdsQuarter,
} from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, EmptyState, Pill, SelectField, Sheet, SheetBody, SheetHead, Table, TableWrap, useToast } from '@mas/ui';
import { AlertTriangle, Check, Download, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { useAppStore, useConfig, useData, useNow } from '@/lib/store';
import styles from './NmdsExport.module.css';
import { NMDS_QUARTER_RANGES, daysToDeadline, nmdsFigures } from './nmdsFigures';
import { nmdsCaveats, nmdsChecks } from './nmdsValidation';
import { fillWorkbook, workbookFileName, type FillResult } from './nmdsWriter';

/**
 * The ASP data workbook return: what would be written, whether it adds up, and the filled workbook.
 *
 * The screen is deliberately a preview first and a download second. A quarterly return to Scottish
 * Ministers is not something to generate and send unseen, and the workbook's own instructions put
 * the responsibility for checking data quality on the person submitting it. So every figure is shown
 * against the sheet and cell it will be written to, the workbook's own consistency checks are run,
 * and the caveat lines are drafted, before a file exists at all.
 *
 * The template is chosen from disk rather than bundled. The workbook is published by the Scottish
 * Government and changes each year, the product makes no network calls, and a template baked into
 * the build would go stale silently. Choosing the file also means the writer checks the edition it
 * was actually given, which is what makes the formula guard worth having.
 */

/** One block of the return, as it will appear in the workbook. */
interface PreviewBlock {
  id: string;
  sheet: string;
  title: string;
  rows: Array<[label: string, value: number | string]>;
}

export function NmdsExport() {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const [quarter, setQuarter] = useState<NmdsQuarter>('q1');
  const [result, setResult] = useState<FillResult | undefined>();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const figures = useMemo(() => nmdsFigures(data, quarter, now), [data, quarter, now]);
  const cells = useMemo(() => nmdsCellMap(figures, quarter), [figures, quarter]);
  const checks = useMemo(() => nmdsChecks(figures), [figures]);
  const caveats = useMemo(() => nmdsCaveats(figures, quarter), [figures, quarter]);
  const range = NMDS_QUARTER_RANGES[quarter];
  const days = daysToDeadline(quarter, now);
  const failures = checks.filter((c) => c.state === 'fail');

  /** The cell a figure will be written to, so a Lead Officer can check it against their own copy. */
  const cellFor = useMemo(() => {
    const index = new Map<string, NmdsCell[]>();
    for (const cell of cells) index.set(cell.sheet, [...(index.get(cell.sheet) ?? []), cell]);
    return index;
  }, [cells]);

  const blocks: PreviewBlock[] = [
    {
      id: 'referrals',
      sheet: NMDS_SHEETS.referrals,
      title: t('reports.nmds.blocks.referrals'),
      rows: ASP_REFERRAL_SOURCES.map((source) => [aspReferralSourceLabel(source), figures.referralsBySource[source] ?? 0]),
    },
    {
      id: 'inquiries',
      sheet: NMDS_SHEETS.inquiries,
      title: t('reports.nmds.blocks.inquiries'),
      rows: [
        [t('reports.nmds.rows.withoutPowers'), figures.inquiriesWithoutPowers],
        [t('reports.nmds.rows.withPowers'), figures.inquiriesWithPowers],
      ],
    },
    {
      id: 'conferences',
      sheet: NMDS_SHEETS.conferences,
      title: t('reports.nmds.blocks.conferences'),
      rows: [
        [t('reports.nmds.rows.initialConferences'), figures.initialCaseConferences],
        [t('reports.nmds.rows.reviewConferences'), figures.reviewCaseConferences],
      ],
    },
    {
      id: 'attendees',
      sheet: NMDS_SHEETS.attendees,
      title: t('reports.nmds.blocks.attendees'),
      rows: [
        [t('reports.nmds.rows.adultsInvited'), figures.adultsInvited],
        [t('reports.nmds.rows.adultUptake'), figures.adultUptakePercent ?? t('reports.asp.notApplicable')],
        [t('reports.nmds.rows.advocatesInvited'), figures.advocatesInvited],
        [t('reports.nmds.rows.advocateUptake'), figures.advocateUptakePercent ?? t('reports.asp.notApplicable')],
      ],
    },
    {
      id: 'plans',
      sheet: NMDS_SHEETS.plansAndPowers,
      title: t('reports.nmds.blocks.plansAndPowers'),
      rows: [
        [t('reports.nmds.rows.managedPlans'), figures.managedPlans],
        [t('reports.nmds.rows.newPlans'), figures.newPlans],
        [t('reports.nmds.rows.assessmentApplied'), figures.ordersAppliedFor.assessment],
        [t('reports.nmds.rows.removalApplied'), figures.ordersAppliedFor.removal],
        [t('reports.nmds.rows.banningApplied'), figures.ordersAppliedFor.banning],
        [t('reports.nmds.rows.assessmentGranted'), figures.ordersGranted.assessment],
        [t('reports.nmds.rows.removalGranted'), figures.ordersGranted.removal],
        [t('reports.nmds.rows.banningGranted'), figures.ordersGranted.banning],
      ],
    },
    {
      id: 'actions',
      sheet: NMDS_SHEETS.actions,
      title: t('reports.nmds.blocks.actions'),
      rows: [
        ...ASP_INQUIRY_ACTIONS.map((a): [string, number] => [t('reports.nmds.rows.withoutPowersPrefix', { label: aspInquiryActionLabel(a) }), figures.actionsWithoutPowers[a] ?? 0]),
        ...ASP_INQUIRY_ACTIONS.map((a): [string, number] => [t('reports.nmds.rows.withPowersPrefix', { label: aspInquiryActionLabel(a) }), figures.actionsWithPowers[a] ?? 0]),
      ],
    },
    {
      id: 'age',
      sheet: NMDS_SHEETS.ageAndGender,
      title: t('reports.nmds.blocks.ageAndGender'),
      rows: ASP_AGE_BANDS.flatMap((band) => ASP_GENDERS.map((gender): [string, number] => [`${aspAgeBandLabel(band)}, ${aspGenderLabel(gender)}`, figures.ageByGender[band]?.[gender] ?? 0])),
    },
    {
      id: 'ethnicity',
      sheet: NMDS_SHEETS.ethnicity,
      title: t('reports.nmds.blocks.ethnicity'),
      rows: ASP_ETHNICITIES.map((e) => [aspEthnicityLabel(e), figures.ethnicity[e] ?? 0]),
    },
    {
      id: 'harm',
      sheet: NMDS_SHEETS.harm,
      title: t('reports.nmds.blocks.harm'),
      rows: [
        ...HARM_TYPES.map((h): [string, number] => [t('reports.nmds.rows.withoutPowersPrefix', { label: harmTypeLabel(h) }), figures.harmWithoutPowers[h] ?? 0]),
        ...HARM_TYPES.map((h): [string, number] => [t('reports.nmds.rows.withPowersPrefix', { label: harmTypeLabel(h) }), figures.harmWithPowers[h] ?? 0]),
      ],
    },
    {
      id: 'location',
      sheet: NMDS_SHEETS.location,
      title: t('reports.nmds.blocks.location'),
      rows: [
        ...ASP_HARM_LOCATIONS.map((l): [string, number] => [t('reports.nmds.rows.withoutPowersPrefix', { label: aspHarmLocationLabel(l) }), figures.locationWithoutPowers[l] ?? 0]),
        ...ASP_HARM_LOCATIONS.map((l): [string, number] => [t('reports.nmds.rows.withPowersPrefix', { label: aspHarmLocationLabel(l) }), figures.locationWithPowers[l] ?? 0]),
      ],
    },
    {
      id: 'client-group',
      sheet: NMDS_SHEETS.clientGroup,
      title: t('reports.nmds.blocks.clientGroup'),
      rows: [
        ...ASP_CLIENT_GROUPS.map((g): [string, number] => [t('reports.nmds.rows.withoutPowersPrefix', { label: aspClientGroupLabel(g) }), figures.clientGroupWithoutPowers[g] ?? 0]),
        ...ASP_CLIENT_GROUPS.map((g): [string, number] => [t('reports.nmds.rows.withPowersPrefix', { label: aspClientGroupLabel(g) }), figures.clientGroupWithPowers[g] ?? 0]),
      ],
    },
    {
      id: 'caring',
      sheet: NMDS_SHEETS.caring,
      title: t('reports.nmds.blocks.caring'),
      rows: [
        [t('reports.nmds.rows.childCare'), figures.adultsWithChildCareResponsibilities],
        [t('reports.nmds.rows.otherCaring'), figures.adultsWithOtherCaringResponsibilities],
        [t('reports.nmds.rows.childPresent'), figures.childPresentAtIncident],
      ],
    },
    {
      id: 'lsis',
      sheet: NMDS_SHEETS.lsis,
      title: t('reports.nmds.blocks.lsis'),
      rows: [
        ...LSI_SERVICE_TYPES.map((s): [string, number] => [lsiServiceTypeLabel(s), figures.lsisByServiceType[s] ?? 0]),
        ...figures.careHomeCsNumbers.map((n): [string, string] => [t('reports.nmds.rows.careHomeCs'), n]),
        ...figures.supportServiceCsNumbers.map((n): [string, string] => [t('reports.nmds.rows.supportServiceCs'), n]),
        ...figures.nhsHospitalCodes.map((n): [string, string] => [t('reports.nmds.rows.hospitalCode'), n]),
      ],
    },
  ];

  async function chooseTemplate(file: File) {
    setBusy(true);
    try {
      const filled = await fillWorkbook(await file.arrayBuffer(), figures, quarter);
      setResult(filled);
      if (filled.error) {
        toast({ title: t('reports.nmds.unreadable.title'), text: t('reports.nmds.unreadable.text'), tone: 'error' });
        return;
      }
      audit({
        act: 'export',
        targetType: 'report',
        targetId: `nmds-${quarter}`,
        targetLabel: t('reports.nmds.audit', { quarter: quarter.toUpperCase(), written: filled.written.length, refused: filled.refused.length }),
        restricted: false,
      });
      toast({
        title: t('reports.nmds.filled.title'),
        text: t('reports.nmds.filled.text', { written: filled.written.length, refused: filled.refused.length }),
        tone: filled.refused.length > 0 ? 'info' : 'success',
      });
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!result?.file) return;
    // Annex 2: aggregate counts that name nobody are routine Official and carry no marking. This
    // return is one exception away from that. Indicators 19b and 19c carry the Care Inspectorate CS
    // number and the NHS hospital code of every service under a Large Scale Investigation, which
    // names a specific provider being investigated, so a return carrying any of them is
    // Official-Sensitive and its file name says so before anyone opens it.
    const namesAService = figures.careHomeCsNumbers.length + figures.supportServiceCsNumbers.length + figures.nhsHospitalCodes.length > 0;
    const { classification } = classify({ artefact: 'aggregate-report', criminalOffenceData: namesAService });
    const name = `${markingFilePrefix(classification)}${workbookFileName(quarter, config.area.councilName)}`;
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
          <h1>{t('reports.nmds.title')}</h1>
          <p className="page-lede">{t('reports.nmds.lede')}</p>
        </div>
      </div>

      <div className={styles.controls}>
        <SelectField
          label={t('reports.nmds.quarterLabel')}
          value={quarter}
          onChange={(e) => {
            setQuarter(e.target.value as NmdsQuarter);
            setResult(undefined);
          }}
          options={NMDS_QUARTERS.map((q) => ({ value: q, label: t(`reports.nmds.quarters.${q}` as const) }))}
        />
        <AppLink href="/reports/asp" className={styles.back}>
          {t('reports.nmds.backToReport')}
        </AppLink>
      </div>

      <p className={styles.meta}>
        {t('reports.nmds.meta', {
          from: formatDate(range.from),
          to: formatDate(range.to),
          due: formatDate(range.due),
          days: Math.abs(days),
          overdue: days < 0 ? 'yes' : 'no',
        })}
      </p>

      <Sheet>
        <SheetHead title={t('reports.nmds.checksTitle')} meta={t('reports.nmds.checksMeta')} headingLevel={2} />
        <SheetBody>
          <ul className={styles.checks}>
            {checks.map((c) => (
              <li key={c.id} data-state={c.state}>
                {c.state === 'pass' ? <Check size={16} aria-hidden="true" /> : c.state === 'fail' ? <AlertTriangle size={16} aria-hidden="true" /> : <span aria-hidden="true">&mdash;</span>}
                <span className={styles.checkLabel}>{c.label}</span>
                <Pill size="sm" tone={c.state === 'pass' ? 'low' : c.state === 'fail' ? 'critical' : 'outline'}>
                  {t(`reports.nmds.checkStates.${c.state === 'not-applicable' ? 'notApplicable' : c.state}` as const)}
                </Pill>
                <span className={styles.checkDetail}>{c.detail}</span>
              </li>
            ))}
          </ul>
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead title={t('reports.nmds.caveatsTitle')} meta={t('reports.nmds.caveatsMeta')} headingLevel={2} />
        <SheetBody>
          {caveats.length === 0 ? (
            <p className={styles.note}>{t('reports.nmds.caveatsNone')}</p>
          ) : (
            <dl className={styles.caveats}>
              {caveats.map((c) => (
                <div key={`${c.sheet}-${c.text}`}>
                  <dt>{c.sheet}</dt>
                  <dd>{c.text}</dd>
                </div>
              ))}
            </dl>
          )}
        </SheetBody>
      </Sheet>

      <Sheet>
        <SheetHead
          title={t('reports.nmds.workbookTitle')}
          meta={t('reports.nmds.workbookMeta', { cells: cells.length })}
          headingLevel={2}
          actions={
            <>
              {/* The visible control is the button; the input is kept out of the tab order so there is
                  one way in, and labelled because a form element without a label is a label violation
                  whether or not anyone can reach it. */}
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx"
                aria-label={t('reports.nmds.chooseTemplate')}
                tabIndex={-1}
                className="visually-hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) void chooseTemplate(chosen);
                }}
              />
              <Button variant="secondary" icon={<Upload size={16} aria-hidden="true" />} disabled={busy} onClick={() => fileInput.current?.click()}>
                {t('reports.nmds.chooseTemplate')}
              </Button>
              <Button variant="primary" icon={<Download size={16} aria-hidden="true" />} disabled={!result?.file} onClick={save}>
                {t('reports.nmds.save')}
              </Button>
            </>
          }
        />
        <SheetBody>
          <p className={styles.note}>{t('reports.nmds.templateNote')}</p>
          {failures.length > 0 ? <p className={styles.warning} role="status">{t('reports.nmds.failuresWarning', { count: failures.length })}</p> : null}
          {result?.refused.length ? (
            <div className={styles.refused} role="status">
              <p>{t('reports.nmds.refusedTitle', { count: result.refused.length })}</p>
              <ul>
                {result.refused.map((r) => (
                  <li key={`${r.cell.sheet}!${r.cell.cell}`}>{t('reports.nmds.refusedRow', { sheet: r.cell.sheet, cell: r.cell.cell, formula: r.formula })}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result?.missingSheets.length ? <p className={styles.warning} role="status">{t('reports.nmds.missingSheets', { sheets: result.missingSheets.join(', ') })}</p> : null}
        </SheetBody>
      </Sheet>

      {blocks.map((block) => {
        const blockCells = cellFor.get(block.sheet) ?? [];
        return (
          <Sheet key={block.id}>
            <SheetHead title={block.title} meta={t('reports.nmds.blockMeta', { sheet: block.sheet })} headingLevel={2} />
            <SheetBody>
              {block.rows.length === 0 ? (
                <EmptyState title={t('reports.nmds.blockEmptyTitle')} text={t('reports.nmds.blockEmptyText')} />
              ) : (
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <th scope="col">{t('reports.nmds.columns.row')}</th>
                        <th scope="col">{t('reports.nmds.columns.cell')}</th>
                        <th scope="col">{t('reports.nmds.columns.value')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, i) => (
                        <tr key={`${block.id}-${i}`}>
                          <th scope="row">{row[0]}</th>
                          <td className={styles.cellRef}>{blockCells[i]?.cell ?? ''}</td>
                          <td className={styles.numeric}>{row[1]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </SheetBody>
          </Sheet>
        );
      })}
    </div>
  );
}
