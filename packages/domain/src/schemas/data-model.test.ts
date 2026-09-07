import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { datasetSchema } from './dataset';

/**
 * `docs/DATA-MODEL.md` is generated from the Zod schemas by `pnpm docs:data-model`, but the list of
 * entities the generator walks is kept by hand, so a collection added to the dataset reaches the
 * document only if somebody remembers to add it. Twice it was not: `documents` on 06 Sep 2026 and
 * `submissions` on 07 Sep, each sitting in the dataset with no table and nothing failing.
 *
 * This is the check that would have caught both. Every collection the dataset holds is an entity a
 * reader of the data model expects to find, so every one of them must have a table. The heading the
 * generator writes is the entity's own name rather than the collection's, so the map below states
 * the pairing once. It caught a third omission on its first run: `personMerges`, which had been a
 * collection with no table for longer than either of the other two.
 */
const HEADINGS: Record<string, string> = {
  organisations: 'Organisation',
  teams: 'Team',
  users: 'User',
  addresses: 'Address',
  people: 'Person',
  households: 'Household',
  relationships: 'Relationship',
  personMerges: 'PersonMerge',
  processes: 'Process (discriminated by type)',
  events: 'ChronologyEvent',
  analyses: 'ChronologyAnalysis',
  meetings: 'Meeting',
  actions: 'Action',
  plans: 'Plan',
  riskAssessments: 'RiskAssessment',
  viewsRecords: 'ViewsRecord',
  lawfulBases: 'LawfulBasisRecord',
  sharingRecords: 'SharingRecord',
  informationRequests: 'InformationRequest',
  involvementRequests: 'InvolvementRequest',
  notifications: 'Notification',
  connectorEvents: 'ConnectorEvent',
  documents: 'Document',
  submissions: 'Submission',
  outbox: 'OutboundWrite',
  inbound: 'InboundChange',
  audit: 'AuditEntry',
};

const DOC = readFileSync(resolve(new URL('../../../..', import.meta.url).pathname, 'docs/DATA-MODEL.md'), 'utf8');

describe('the data model document covers the dataset', () => {
  const collections = Object.keys(datasetSchema.shape).filter((key) => key !== 'meta');

  it('names a heading for every collection the dataset holds', () => {
    expect(collections.filter((key) => !HEADINGS[key])).toEqual([]);
  });

  it.each(collections.map((key) => [key] as const))('%s has a table in docs/DATA-MODEL.md', (key) => {
    const heading = HEADINGS[key];
    expect(heading, `a heading for the ${key} collection`).toBeDefined();
    expect(DOC, `run pnpm docs:data-model, and add ${heading} to the entity list in generate-data-model.ts if it is missing`).toContain(`### ${heading}\n`);
  });
});
