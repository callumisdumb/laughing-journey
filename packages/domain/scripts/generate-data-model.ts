/**
 * Walks the Zod schemas and regenerates the entity tables in docs/DATA-MODEL.md
 * below the "## Generated tables" heading. The prose above it is hand-written.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import * as schemas from '../src/schemas';

const target = resolve(import.meta.dirname, '../../../docs/DATA-MODEL.md');
const marker = '## Generated tables';

type JsonSchema = Record<string, unknown> & { properties?: Record<string, JsonSchema>; required?: string[]; type?: string | string[]; enum?: unknown[]; anyOf?: JsonSchema[]; oneOf?: JsonSchema[]; items?: JsonSchema; description?: string; const?: unknown; format?: string; $ref?: string };

function typeOf(s: JsonSchema): string {
  if (s.$ref) return s.$ref.replace('#/$defs/', '');
  if (s.const !== undefined) return `literal ${JSON.stringify(s.const)}`;
  if (s.enum) return s.enum.length > 6 ? `enum (${s.enum.length} values)` : s.enum.map((v) => JSON.stringify(v)).join(' \\| ');
  if (s.anyOf) return s.anyOf.map(typeOf).join(' or ');
  if (s.oneOf) return s.oneOf.map(typeOf).join(' or ');
  if (s.type === 'array') return `array of ${s.items ? typeOf(s.items) : 'unknown'}`;
  if (s.type === 'object') return s.properties ? `object { ${Object.keys(s.properties).join(', ')} }` : 'object';
  if (s.format) return `${String(s.type)} (${s.format})`;
  if (Array.isArray(s.type)) return s.type.join(' or ');
  return String(s.type ?? 'unknown');
}

function table(name: string, schema: z.ZodType): string {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any', reused: 'inline' }) as JsonSchema;
  const lines: string[] = [`### ${name}`, ''];
  const variants = json.anyOf ?? json.oneOf;
  const objects = variants ? variants : [json];
  objects.forEach((obj, i) => {
    if (variants) lines.push(`Variant ${i + 1}`, '');
    lines.push('| Field | Type | Required |', '|---|---|---|');
    const req = new Set(obj.required ?? []);
    for (const [key, prop] of Object.entries(obj.properties ?? {})) {
      lines.push(`| \`${key}\` | ${typeOf(prop)} | ${req.has(key) ? 'yes' : 'no'} |`);
    }
    lines.push('');
  });
  return lines.join('\n');
}

const entities: Array<[string, z.ZodType]> = [
  ['Organisation', schemas.organisationSchema],
  ['Team', schemas.teamSchema],
  ['User', schemas.userSchema],
  ['Address', schemas.addressSchema],
  ['Person', schemas.personSchema],
  ['Household', schemas.householdSchema],
  ['Relationship', schemas.relationshipSchema],
  ['Process (discriminated by type)', schemas.processSchema],
  ['AspDetail', schemas.aspDetailSchema],
  ['CpDetail', schemas.cpDetailSchema],
  ['MaracDetail', schemas.maracDetailSchema],
  ['MappaDetail', schemas.mappaDetailSchema],
  ['AwiDetail', schemas.awiDetailSchema],
  ['ChronologyEvent', schemas.chronologyEventSchema],
  ['ChronologyAnalysis', schemas.chronologyAnalysisSchema],
  ['Meeting', schemas.meetingSchema],
  ['Decision', schemas.decisionSchema],
  ['Action', schemas.actionSchema],
  ['Plan', schemas.planSchema],
  ['RiskAssessment', schemas.riskAssessmentSchema],
  ['ViewsRecord', schemas.viewsRecordSchema],
  ['LawfulBasisRecord', schemas.lawfulBasisRecordSchema],
  ['SharingRecord', schemas.sharingRecordSchema],
  ['InformationRequest', schemas.informationRequestSchema],
  ['ConnectorEvent', schemas.connectorEventSchema],
  ['AuditEntry', schemas.auditEntrySchema],
  ['ClockRule', schemas.clockRuleSchema],
  ['NeedToKnowRow', schemas.needToKnowRowSchema],
  ['Exclusion', schemas.exclusionSchema],
  ['Config', schemas.configSchema],
];

const generated = [marker, '', `Generated on ${new Date().toISOString().slice(0, 10)} by \`pnpm docs:data-model\`. Do not edit below this line.`, '', ...entities.map(([n, s]) => table(n, s))].join('\n');
const current = readFileSync(target, 'utf8');
const head = current.includes(marker) ? current.slice(0, current.indexOf(marker)) : current + '\n';
writeFileSync(target, head + generated + '\n');
console.log(`wrote ${entities.length} entity tables to docs/DATA-MODEL.md`);
