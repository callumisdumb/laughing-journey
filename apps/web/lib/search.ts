/**
 * Global search across name, alias, date of birth, CHI, address and reference number.
 * Pure function over the dataset; the TopBar typeahead and the Search screen share it.
 */
import { formatDate, type Dataset, type Person, type Process } from '@mas/domain';

export interface PersonHit {
  kind: 'person';
  person: Person;
  score: number;
  matched: string;
}

export interface ProcessHit {
  kind: 'process';
  process: Process;
  score: number;
  matched: string;
}

export type SearchHit = PersonHit | ProcessHit;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dobForms(dob: string | undefined): string[] {
  if (!dob) return [];
  const [y, m, d] = dob.split('-');
  return [dob, `${d}/${m}/${y}`, `${d}${m}${y}`, `${d}/${m}/${(y ?? '').slice(2)}`, formatDate(dob).toLowerCase()];
}

export function searchDataset(data: Dataset, query: string, limit = 50): SearchHit[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const terms = q.split(' ').filter(Boolean);
  const hits: SearchHit[] = [];

  for (const p of data.people) {
    const name = norm(`${p.givenName} ${p.familyName}`);
    const preferred = p.preferredName ? norm(p.preferredName) : '';
    const aliases = p.aliases.map(norm);
    const dob = dobForms(p.dateOfBirth).map(norm);
    const addr = p.addressHistory
      .map((h) => data.addresses.find((a) => a.id === h.addressId))
      .filter(Boolean)
      .map((a) => norm(`${a!.line1} ${a!.line2 ?? ''} ${a!.town} ${a!.postcode}`));
    let score = 0;
    let matched = '';
    if (name === q) {
      score = 100;
      matched = 'name';
    } else if (terms.every((t) => name.includes(t))) {
      score = 80 + (name.startsWith(q) ? 10 : 0);
      matched = 'name';
    } else if (preferred && preferred.includes(q)) {
      score = 70;
      matched = 'preferred name';
    } else if (aliases.some((a) => a.includes(q))) {
      score = 70;
      matched = 'alias';
    } else if (p.chi && p.chi.includes(q.replace(/\s/g, ''))) {
      score = 90;
      matched = 'CHI (synthetic)';
    } else if (dob.some((d) => d === q || d === q.replace(/\s/g, ''))) {
      score = 75;
      matched = 'date of birth';
    } else if (addr.some((a) => terms.every((t) => a.includes(t)))) {
      score = 60;
      matched = 'address';
    }
    if (score > 0) hits.push({ kind: 'person', person: p, score, matched });
  }

  for (const pr of data.processes) {
    const ref = norm(pr.reference);
    if (ref === q || ref.replace(/\s/g, '') === q.replace(/\s/g, '')) hits.push({ kind: 'process', process: pr, score: 95, matched: 'reference' });
    else if (ref.includes(q)) hits.push({ kind: 'process', process: pr, score: 65, matched: 'reference' });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
