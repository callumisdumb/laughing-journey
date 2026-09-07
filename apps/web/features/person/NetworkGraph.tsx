'use client';

import { membersOn, type Dataset, type Person, type Relationship } from '@mas/domain';
import { hasMessage, tKey, useT } from '@mas/messages';
import { fullName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import styles from './NetworkGraph.module.css';

/** Relationship types are kebab-case enum values; their catalogue keys are the camelCase form. */
function relationSegment(type: Relationship['type']): string {
  return type.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** The word for the other person as the relationship names them, such as "mother" for mother-of. */
export function relationWord(type: Relationship['type']): string {
  return tKey(`person.network.relation.${relationSegment(type)}`);
}

/** The word seen from the subject's side where the catalogue records one ("child" for mother-of), else the plain word. */
export function inverseWord(type: Relationship['type']): string {
  const key = `person.network.inverse.${relationSegment(type)}`;
  return hasMessage(key) ? tKey(key) : relationWord(type);
}

export interface NetworkNode {
  person: Person;
  relation: string;
  household: boolean;
}

/** Everyone the diagram would draw around the subject: one node per related person, household members marked. */
export function networkNodes(data: Dataset, person: Person, on: string): NetworkNode[] {
  const rels = data.relationships.filter((r) => (r.fromPersonId === person.id || r.toPersonId === person.id) && !(r.to && r.to <= on));
  const home = data.households.find((h) => h.id === person.householdId);
  const household = new Set(home ? membersOn(home, on).map((m) => m.personId) : []);
  const nodes = new Map<string, NetworkNode>();
  for (const r of rels) {
    const otherId = r.fromPersonId === person.id ? r.toPersonId : r.fromPersonId;
    const other = data.people.find((p) => p.id === otherId);
    if (!other || nodes.has(otherId)) continue;
    const relation = r.fromPersonId === person.id ? inverseWord(r.type) : relationWord(r.type);
    nodes.set(otherId, { person: other, relation, household: household.has(otherId) });
  }
  // Household members with no relationship record are still around the person.
  for (const id of household) {
    if (id === person.id || nodes.has(id)) continue;
    const other = data.people.find((p) => p.id === id);
    if (other) nodes.set(id, { person: other, relation: tKey('person.network.noRelationship'), household: true });
  }
  return [...nodes.values()];
}

export interface NetworkGraphProps {
  person: Person;
  /** People flagged as an adult of concern (e.g. alleged perpetrator) are drawn dashed. */
  concernIds?: string[];
  /** The date the household is read as at, so the diagram and the card around it agree. */
  on: string;
}

/**
 * Household and network as a picture: the subject in the centre, the household on an inner ring,
 * everyone else on an outer ring.
 *
 * It is decoration. Every name it draws is in the card's lists as a link, so the SVG is hidden from
 * assistive technology and sizes to what it draws: a household with no outer ring gets a shorter
 * canvas, and a person with nobody around them gets no diagram at all, because the card does not
 * offer the toggle (D-230).
 */
export function NetworkGraph({ person, concernIds = [], on }: NetworkGraphProps) {
  const t = useT();
  const data = useData();
  const list = networkNodes(data, person, on);
  const inner = list.filter((n) => n.household);
  const outer = list.filter((n) => !n.household);
  const W = 640;
  const H = outer.length > 0 ? 360 : inner.length > 0 ? 250 : 120;
  const cx = W / 2;
  const cy = H / 2;
  const place = (items: NetworkNode[], radius: number, offset: number) =>
    items.map((n, i) => {
      const angle = offset + (i / Math.max(items.length, 1)) * Math.PI * 2;
      return { ...n, x: cx + Math.cos(angle) * radius * 0.7, y: cy + Math.sin(angle) * radius * 0.78 };
    });
  const placed = [...place(inner, outer.length > 0 ? 120 : 110, -Math.PI / 2), ...place(outer, 210, -Math.PI / 2 + Math.PI / 5)];
  const concern = list.some((n) => concernIds.includes(n.person.id));

  return (
    <div className={styles.graph} data-testid="network-graph">
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
                {n.person.dateOfBirth ? `, ${Number(on.slice(0, 4)) - Number(n.person.dateOfBirth.slice(0, 4))}` : ''}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Only the kinds actually drawn: a legend of empty categories is a diagram saying nothing twice. */}
      <div className={styles.legend} aria-hidden="true">
        {inner.length > 0 ? (
          <span className={styles.legendItem}>
            <span className={styles.swatch} data-kind="household" /> {t('person.network.legend.household')}
          </span>
        ) : null}
        {outer.length > 0 ? (
          <span className={styles.legendItem}>
            <span className={styles.swatch} data-kind="other" /> {t('person.network.legend.wider')}
          </span>
        ) : null}
        {concern ? (
          <span className={styles.legendItem}>
            <span className={styles.swatch} data-kind="concern" /> {t('person.network.legend.concern')}
          </span>
        ) : null}
        <span className={styles.legendNote}>{t('person.overview.network.meta')}</span>
      </div>
    </div>
  );
}
