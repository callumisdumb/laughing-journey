'use client';

import { membersOn, type Person, type Relationship } from '@mas/domain';
import { hasMessage, tKey, useT } from '@mas/messages';
import { fullName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import styles from './NetworkGraph.module.css';
import { PersonLink } from '@/components/EntityLink';

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
  /** The date the household is read as at, so the diagram and the panel above it agree. */
  on: string;
}

/** Household and network: the subject in the centre, household inner ring, everyone else outer ring. */
export function NetworkGraph({ person, concernIds = [], on }: NetworkGraphProps) {
  const t = useT();
  const data = useData();
  const rels = data.relationships.filter((r) => r.fromPersonId === person.id || r.toPersonId === person.id);
  const home = data.households.find((h) => h.id === person.householdId);
  const household = new Set(home ? membersOn(home, on).map((m) => m.personId) : []);
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

  return (
    <div className={styles.graph}>
      {/* Decorative now: everything it says is in the list below it, as text and as links. */}
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
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
      {/*
        The list is the navigation and the diagram is the picture.
        
        It used to be visually hidden, an accessible alternative to an `img`-role SVG. That was
        correct as far as it went and it meant the one place in the product that shows who is around
        a person offered no way to reach any of them: a name in an SVG `text` element cannot be a
        link, and a sighted reader who wanted the sister's record went back to search and typed it.
        Now everyone gets the same list, and the diagram is decoration.
      */}
      <ul className={styles.people}>
        {list.map((n) => (
          <li key={n.person.id} className={styles.person} data-household={n.household ? 'true' : undefined}>
            <PersonLink person={n.person} />
            <span className={styles.personRelation}>{t('person.network.listItem', { name: '', relation: n.relation, household: n.household ? 'yes' : 'no' }).trim()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
