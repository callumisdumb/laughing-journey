'use client';

import { notificationKindLabel } from '@mas/domain';
import { useT } from '@mas/messages';
import { Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { useData } from '@/lib/store';
import { userName } from '@/lib/selectors';
import styles from './Admin.module.css';

/**
 * The digest that does not go out (D-254).
 *
 * The handover has always said that nothing reaches somebody who is not signed in. This is that
 * statement made inspectable: every notification the product wrote, counted by kind and recipient,
 * which is exactly what a deployment with email would have sent. It carries counts and never
 * content, so the screen itself cannot become a second way to read case information, and the note
 * says what adding email would require.
 */
export function Digest() {
  const t = useT();
  const data = useData();
  const rows = new Map<string, { recipient: string; kind: string; count: number }>();
  for (const n of data.notifications) {
    const user = n.toUserId ? data.users.find((u) => u.id === n.toUserId) : undefined;
    const recipient = user ? userName(user) : n.toRole ? t('admin.digest.column.recipient') : '';
    if (!recipient) continue;
    const key = `${recipient}:${n.kind}`;
    const held = rows.get(key);
    rows.set(key, { recipient, kind: notificationKindLabel(n.kind), count: (held?.count ?? 0) + 1 });
  }
  const list = [...rows.values()].sort((a, b) => (a.recipient === b.recipient ? b.count - a.count : a.recipient < b.recipient ? -1 : 1));
  const people = new Set(list.map((r) => r.recipient)).size;
  const total = list.reduce((n, r) => n + r.count, 0);

  return (
    <Sheet>
      <SheetHead title={t('admin.digest.title')} meta={t('admin.digest.meta')} divided />
      <SheetBody>
        <div className="stack">
          <p className={styles.note} data-testid="digest-total">
            {t('admin.digest.total', { count: total, people })}
          </p>
          {list.length === 0 ? (
            <p>{t('admin.digest.empty')}</p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('admin.digest.column.recipient')}</th>
                    <th scope="col">{t('admin.digest.column.kind')}</th>
                    <th scope="col">{t('admin.digest.column.count')}</th>
                  </tr>
                </thead>
                <tbody data-testid="digest-rows">
                  {list.map((r) => (
                    <tr key={`${r.recipient}:${r.kind}`}>
                      <td>{r.recipient}</td>
                      <td>{r.kind}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
          <p className={styles.note}>{t('admin.digest.note')}</p>
        </div>
      </SheetBody>
    </Sheet>
  );
}
