# Report templates

The official templates for the inspection returns. A report screen is reconciled against its template once the file is here: every template column is matched to a computed figure or a documented gap, anything the template does not ask for is removed, and the "to verify" marker comes off that report.

## Here

| File | What it is | Used by |
|---|---|---|
| `ASP-data-workbook-2026-27.xlsx` | The mandated quarterly ASP National Minimum Dataset return workbook, version 1.1 (mid 2026), returned to ASPData@gov.scot. Fifteen sheets, one column per quarter from Q1 2023/24 to Q4 2031/32. | `/reports/asp?nmds=1` fills a copy of it. `packages/domain/src/nmds/cellMap.ts` maps every figure to a cell, and `cellMap.test.ts` reads this file to prove it. |
| `ASP-NMDS-guidance-July-2025.docx` | The single guidance document: what each indicator counts, from which date, and what the checks mean. | `docs/RESEARCH.md` 5.14; the counting rules in `apps/web/features/reports/nmdsFigures.ts`. |
| `ASP-NMDS-glossary-July-2025.docx` | Definitions in alphabetical order, including the protection orders and their durations. | The four ASP order clock rules; `docs/RESEARCH.md` 5.14. |

These files are the source of truth for the ASP field sets. When a new edition arrives, replace the file, re-run `pnpm --filter @mas/domain test`, and the cell map test will name every row that has moved. Regenerate `packages/domain/src/nmds/workbook-2026-27.fields.json` from column A of each indicator sheet at the same time.

## Still wanted

Drop the remaining templates here, one file each:

| Report | Expected template | Screen |
|---|---|---|
| Child Protection Register statistics | Children's Social Work Statistics: child protection return specification | `/reports/cp` |
| MARAC SafeLives return | SafeLives MARAC data template workbook (quarterly) | `/reports/marac` |
| MAPPA annual report counts | MAPPA annual report table set (Scottish Government overview report appendix) | `/reports/mappa` |
| AWI application timeliness | Mental Welfare Commission AWI monitoring return and Office of the Public Guardian guardianship performance measures | `/reports/awi` |

Until a template is here, that report's meta line says "Field set to verify against the current template" and `docs/RESEARCH.md` section 5 records what the field set was built from.
