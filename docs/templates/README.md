# Report templates

The official templates for the inspection returns. A report screen is reconciled against its template once the file is here: every template column is matched to a computed figure or a documented gap, anything the template does not ask for is removed, and the "to verify" marker comes off that report.

## Here

| File | What it is | Used by |
|---|---|---|
| `ASP-data-workbook-2026-27.xlsx` | The mandated quarterly ASP National Minimum Dataset return workbook, version 1.1 (mid 2026), returned to ASPData@gov.scot. Fifteen sheets, one column per quarter from Q1 2023/24 to Q4 2031/32. | `/reports/asp?nmds=1` fills a copy of it. `packages/domain/src/nmds/cellMap.ts` maps every figure to a cell, and `cellMap.test.ts` reads this file to prove it. |
| `ASP-NMDS-guidance-July-2025.docx` | The single guidance document: what each indicator counts, from which date, and what the checks mean. | `docs/RESEARCH.md` 5.14; the counting rules in `apps/web/features/reports/nmdsFigures.ts`. |
| `ASP-NMDS-glossary-July-2025.docx` | Definitions in alphabetical order, including the protection orders and their durations. | The four ASP order clock rules; `docs/RESEARCH.md` 5.14. |
| `New-Marac-data-template-Scotland-2025.xlsx` | The SafeLives MARAC data return, Scotland wording: one sheet, 32 columns A to AF, headers in row 1, one row per meeting. Downloaded 06 Sep 2026. | `/reports/marac?safelives=1` fills a copy of it. `packages/domain/src/safelives/` holds the column map and `safelives.test.ts` reads this file to prove the header row. |
| `New-Marac-data-template-2025.xlsx` | The UK edition of the same return, which heads the fourteen referral source columns differently (IDVA, Probation, Children's Social Care). Kept so the difference is a test, not a claim. | `safelives.test.ts`; the context file's alternative wording for a deployment outside Scotland. |
| `MWC-AWI-Monitoring-Report-2024-25.pdf` | Mental Welfare Commission for Scotland, Adults with Incapacity Act monitoring report 2024-25 (October 2025, 51 pages). Table 1, Table 2 and Appendix B's data tables are the AWI report's field set. | `/reports/awi`; `docs/RESEARCH.md` 9.3. |

These files are the source of truth for the ASP field sets. When a new edition arrives, replace the file, re-run `pnpm --filter @mas/domain test`, and the cell map test will name every row that has moved. Regenerate `packages/domain/src/nmds/workbook-2026-27.fields.json` from column A of each indicator sheet at the same time.

## Nothing still wanted

Every report's field set now comes from its template or its publication. The ASP data collection web page says an update to the NMDS guidance document is pending for summer 2026 (`docs/RESEARCH.md` 9.1): when it lands, replace `ASP-NMDS-guidance-July-2025.docx` here and re-read the counting notes in 5.14 against it. The Office of the Public Guardian's welfare, financial and combined split on the AWI report comes from its performance page (5.11) rather than a file.

## Read from the source, no file expected

Two reports need no template file because their field sets were read from the source itself and are pinned in the catalogue as `verbatim` keys: the Child Protection Register statistics, whose Table 1.1 to 1.5 row sets were read from Children's Social Work Statistics: Child Protection 2024-25 on 03 Sep 2026 (`docs/RESEARCH.md` 5.16), and the MAPPA annual report, whose nine tables carry the wording of Annex 3 of the MAPPA National Guidance, supplied verbatim the same day (`docs/RESEARCH.md` 5.12).
