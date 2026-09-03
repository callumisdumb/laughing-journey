'use client';

import { DEFAULT_CONFIG } from '@mas/domain';
import { Button, Pill, Table, TableWrap, TextField } from '@mas/ui';
import { useState } from 'react';
import styles from './Labels.module.css';
import { SectionHead } from './SectionHead';
import { useAdminConfig } from './useAdminConfig';

export function Labels() {
  const { config, canEdit, save } = useAdminConfig();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rows = Object.entries(config.labels).sort(([a], [b]) => a.localeCompare(b));

  function startEdit(id: string, text: string) {
    setEditing(id);
    setDraft(text);
    setError(null);
  }

  function commit(id: string) {
    const text = draft.trim();
    if (text.length === 0) {
      setError('Enter the label text');
      return;
    }
    const result = save({ ...config, labels: { ...config.labels, [id]: text } }, 'labels', `Label ${id}: "${text}"`);
    if (!result.ok) {
      setError(result.errors.join('. '));
      return;
    }
    setEditing(null);
    setError(null);
  }

  function restore(id: string) {
    const text = DEFAULT_CONFIG.labels[id];
    if (text === undefined) return;
    save({ ...config, labels: { ...config.labels, [id]: text } }, 'labels', `Label ${id} restored to "${text}"`);
    if (editing === id) setEditing(null);
  }

  return (
    <>
      <SectionHead title="Labels" lede="Names that vary by area. Some areas call an IRD an Initial Referral Discussion; the guidance says Inter-agency. Change the text, not the meaning." />
      <TableWrap label="Labels">
        <Table>
          <thead>
            <tr>
              <th scope="col">Label id</th>
              <th scope="col">Current text</th>
              <th scope="col">Default</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([id, text]) => {
              const fallback = DEFAULT_CONFIG.labels[id];
              const changed = fallback !== undefined && fallback !== text;
              const isEditing = editing === id;
              return (
                <tr key={id} data-state={changed ? 'changed' : undefined}>
                  <td className={styles.id}>{id}</td>
                  <td>
                    {isEditing ? (
                      <div className={styles.editCell}>
                        <TextField label={`New text for ${id}`} value={draft} maxLength={120} autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit(id)} error={error} />
                        <div className={styles.editActions}>
                          <Button size="sm" variant="primary" onClick={() => commit(id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="quiet" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <span className={styles.text}>
                        {text}
                        {changed ? (
                          <Pill size="sm" tone="accent">
                            changed
                          </Pill>
                        ) : null}
                      </span>
                    )}
                  </td>
                  <td className={styles.fallback}>{fallback === undefined ? 'No default' : changed ? fallback : 'Same as current'}</td>
                  <td>
                    <div className={styles.rowActions}>
                      {!isEditing ? (
                        <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => startEdit(id, text)}>
                          Edit
                        </Button>
                      ) : null}
                      <Button size="sm" variant="quiet" disabled={!canEdit || !changed} onClick={() => restore(id)}>
                        Restore default
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
