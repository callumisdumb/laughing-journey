'use client';

import type { Person, Relationship } from '@mas/domain';
import { hasMessage, tKey, useT } from '@mas/messages';
import { fullName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import styles from './NetworkGraph.module.css';

/** Relationship types are kebab-case enum values; their catalogue keys are the camelCase form. */
function relationSegment(type: Relationship['type']): string {
  return type.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** The word for the other person as the relationship names them, such as "mother" for mother-of. */
function relationWord(type: Relationship['type']): string {
  return tKey(`person.network.relation.${relationSegment(type)}`);
}

/** The word seen from the subject's side where the catalogue records one ("child" for mother-of), else the plain word. */
function inverseWord(type: Relationship['type']): string {
  const key = `person.network.inverse.${relationSegment(type)}`;
  return hasMessage(key) ? tKey(key) : relationWord(type);
}

export interface NetworkGraphProps {
  person: Person;
  /** People flagged as an adult of concern (e.g. alleged perpetrator) are drawn dashed. */
  concernIds?: string[];
}

/** Household and network: the subject in the centre, household inner ring, everyone else outer ring. */
export function NetworkGraph({ person, concernIds = [] }: NetworkGraphProps) {
  const t = useT();
  const data = useData();
  const rels = data.relationships.filter((r) => r.fromPersonId === person.id || r.toPersonId === person.id);
  const household = new Set(data.households.find((h) => h.id === person.householdId)?.memberIds ?? []);
  const nodes = new Map<string, { person: Person; relation: string; household: boolean }>();
  for (const r of rels) {
    const otherId = r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId;
    const other = data.people.find((p) => p.id === otherId);
    if (!other || nodes.has(otherId)) continue;
    const relation = r.fromPersonId === person.id ? inverseWord(r.type) : relationWord(r.type);
    nodes.set(otherId, { person: other, relation, household: household.has(otherId) });
  }
  const list = [...nodes.values()];
  const inner = list.filter((n) => n.household);
  const outer = list.filter((n) => !n.household);
  const W = 640;
  const H = 360;
  const cx = W / 2;
  const cy = H / 2;
  const place = (items: typeof list, radius: number, offset: number) =>
    items.map((n, i) => {
      const angle = offset + (i / Math.max(items.length, 1)) * Math.PI * 2;
      return { ...n, x: cx + Math.cos(angle) * radius * 0.7, y: cy + Math.sin(angle) * radius * 0.78 };
    });
  const placed = [...place(inner, 120, -Math.PI / 2), ...place(outer, 210, -Math.PI / 2 + Math.PI / 5)];
  const summary = list.map((n) => t('person.network.member', { name: fullName(n.person), relation: n.relation, household: n.household ? 'yes' : 'no' })).join('; ');

  return (
    <div className={styles.graph}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('person.network.summary', { name: fullName(person), list: summary || t('person.network.noRelationships') })}>
        {placed.map((n) => (
          <line key={`e-${n.person.id}`} className={styles.edge} data-household={n.household ? 'true' : undefined} x1={cx} y1={cy} x2={n.x} y2={n.y} />
        ))}
        <g className={styles.node} data-subject="true">
          <circle cx={cx} cy={cy} r={11} />
          <text className={styles.name} x={cx} y={cy + 28} textAnchor="middle">
            {fullName(person)}
          </text>
        </g>
        {placed.map((n) => {
          const right = n.x >= cx;
          return (
            <g key={n.person.id} className={styles.node} data-household={n.household ? 'true' : undefined} data-concern={concernIds.includes(n.person.id) ? 'true' : undefined}>
              <circle cx={n.x} cy={n.y} r={8} />
              <text className={styles.name} x={n.x + (right ? 13 : -13)} y={n.y - 3} textAnchor={right ? 'start' : 'end'}>
                {fullName(n.person)}
              </text>
              <text className={styles.relation} x={n.x + (right ? 13 : -13)} y={n.y + 13} textAnchor={right ? 'start' : 'end'}>
                {n.relation}
                {n.person.dateOfBirth ? `, ${new Date().getFullYear() - Number(n.person.dateOfBirth.slice(0, 4))}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-kind="household" /> {t('person.network.legend.household')}
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-kind="other" /> {t('person.network.legend.wider')}
        </span>
        {concernIds.length > 0 ? (
          <span className={styles.legendItem}>
            <span className={styles.swatch} data-kind="concern" /> {t('person.network.legend.concern')}
          </span>
        ) : null}
      </div>
      <ul className="visually-hidden">
        {list.map((n) => (
          <li key={n.person.id}>{t('person.network.listItem', { name: fullName(n.person), relation: n.relation, household: n.household ? 'yes' : 'no' })}</li>
        ))}
      </ul>
    </div>
  );
}
