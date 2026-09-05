import { subDays, subHours } from 'date-fns';
import type { BuildContext } from './context';
import { makeAudit } from './factory';
import { USR } from './organisations';

/** A believable audit trail: reads by case members, a persona switch, a share, an export. */
export function seedAudit(ctx: BuildContext): void {
  const iso = (d: Date) => d.toISOString();
  for (const p of ctx.data.processes) {
    const subject = ctx.data.people.find((x) => x.id === p.subjectIds[0]);
    const label = subject ? `${subject.givenName} ${subject.familyName}` : p.reference;
    p.members.forEach((m, i) => {
      const u = ctx.user(m.userId);
      const n = ctx.rng.int(1, 4);
      for (let k = 0; k < n; k += 1) {
        makeAudit(ctx, {
          at: iso(subHours(subDays(ctx.now, ctx.rng.int(0, 40)), i + k * 5)),
          userId: u.id,
          userName: `${u.givenName} ${u.familyName}`,
          agency: u.agency,
          act: p.accessRestriction === 'restricted' ? 'read-restricted' : 'read',
          targetType: 'process',
          targetId: p.id,
          targetLabel: `${p.reference}: ${label}`,
          processId: p.id,
          restricted: p.accessRestriction === 'restricted',
        });
      }
    });
  }
  for (const s of ctx.data.sharingRecords) {
    makeAudit(ctx, { at: s.createdAt, userId: s.createdByUserId ?? USR.lesleyMorton, userName: s.createdByName, agency: 'social-work', act: 'share', targetType: 'sharing', targetId: s.id, targetLabel: `${s.detailLevel} to ${s.recipient.name}`, processId: s.processId, restricted: false });
  }
  makeAudit(ctx, { at: iso(subDays(ctx.now, 1)), userId: USR.lesleyMorton, userName: 'Lesley Morton', agency: 'social-work', act: 'export', targetType: 'meeting', targetId: 'mtg_aiden_cppm', targetLabel: 'CPPM pack: Aiden Boyle', processId: 'prc_cp_aiden', restricted: false });
  ctx.data.audit.sort((a, b) => (a.at < b.at ? 1 : -1));
}
