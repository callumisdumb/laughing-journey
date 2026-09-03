'use client';

import { useT } from '@mas/messages';
import { Table, TableWrap } from '@mas/ui';
import type { TableSpec } from './model';
import styles from './SectionTable.module.css';

/** A report table: column headers, right-aligned numbers, and an honest empty row. */
export function SectionTable({ table, fallbackLabel }: { table: TableSpec; fallbackLabel: string }) {
  const t = useT();
  const numeric = new Set(table.numeric ?? []);
  return (
    <div className={styles.block}>
      {table.title ? <h3 className={styles.title}>{table.title}</h3> : null}
      {table.note ? <p className={styles.note}>{table.note}</p> : null}
      <TableWrap label={table.title ?? fallbackLabel}>
        <Table>
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={c} scope="col" data-align={numeric.has(i) ? 'num' : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 ? (
              <tr>
                <td colSpan={table.columns.length} data-muted="true">
                  {table.empty ?? t('reports.table.empty')}
                </td>
              </tr>
            ) : (
              table.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} data-align={numeric.has(ci) ? 'num' : undefined} className={ci === 0 ? styles.lead : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
