'use client';

import type { Person, Relationship } from '@mas/domain';
import { fullName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import styles from './NetworkGraph.module.css';

const RELATION_WORDS: Record<Relationship['type'], string> = {
  'mother-of': 'mother',
  'father-of': 'father',
  'parent-of': 'parent',
  'step-parent-of': 'step-parent',
  'child-of': 'child',
  'unborn-child-of': 'unborn child',
  'partner-of': 'partner',
  'ex-partner-of': 'ex-partner',
  'sibling-of': 'sibling',
  'grandparent-of': 'grandparent',
  'grandchild-of': 'grandchild',
  'aunt-or-uncle-of': 'aunt or uncle',
  'nephew-or-niece-of': 'nephew or niece',
  'relative-of': 'relative',
  'carer-of': 'carer',
  'attorney-for': 'attorney',
  'guardian-for': 'guardian',
  'lives-with': 'lives with',
  'associate-of': 'associate',
  'landlord-of': 'landlord',
  'professional-for': 'professional',
};

const INVERSE: Partial<Record<Relationship['type'], string>> = {
  'mother-of': 'child',
  'father-of': 'child',
  'parent-of': 'child',
  'step-parent-of': 'step-child',
  'child-of': 'parent',
  'unborn-child-of': 'expectant parent',
  'grandparent-of': 'grandchild',
  'grandchild-of': 'grandparent',
  'aunt-or-uncle-of': 'nephew or niece',
  'nephew-or-niece-of': 'aunt or uncle',
  'carer-of': 'cared for by',
  'attorney-for': 'grants power to',
  'guardian-for': 'under guardianship of',
  'landlord-of': 'tenant of',
  'professional-for': 'supported by',
};

export interface NetworkGraphProps {
  person: Person;
  /** People flagged as an adult of concern (e.g. alleged perpetrator) are drawn dashed. */
  concernIds?: string[];
}

/** Household and network: the subject in the centre, household inner ring, everyone else outer ring. */
export function NetworkGraph({ person, concernIds = [] }: NetworkGraphProps) {
  const data = useData();
  const rels = data.relationships.filter((r) => r.fromPersonId === person.id || r.toPersonId === person.id);
  const household = new Set(data.households.find((h) => h.id === person.householdId)?.memberIds ?? []);
  const nodes = new Map<string, { person: Person; relation: string; household: boolean }>();
  for (const r of rels) {
    const otherId = r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId;
    const other = data.people.find((p) => p.id === otherId);
    if (!other || nodes.has(otherId)) continue;
    const relation = r.fromPersonId === person.id ? (INVERSE[r.type] ?? RELATION_WORDS[r.type]) : RELATION_WORDS[r.type];
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

  return (
    <div className={styles.graph}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Network of ${fullName(person)}: ${list.map((n) => `${fullName(n.person)}, ${n.relation}${n.household ? ', same household' : ''}`).join('; ') || 'no relationships recorded'}`}>
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
          <span className={styles.swatch} data-kind="household" /> Same household
        </span>
        <span className={styles.legendItem}>
          <span className={styles.swatch} data-kind="other" /> Wider network
        </span>
        {concernIds.length > 0 ? (
          <span className={styles.legendItem}>
            <span className={styles.swatch} data-kind="concern" /> Adult of concern
          </span>
        ) : null}
      </div>
      <ul className="visually-hidden">
        {list.map((n) => (
          <li key={n.person.id}>
            {fullName(n.person)}: {n.relation}
            {n.household ? ', same household' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
