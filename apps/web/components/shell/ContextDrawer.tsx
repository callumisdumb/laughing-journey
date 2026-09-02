'use client';

import { AGENCY_SHORT, DETAIL_LEVEL_LABELS, ROLE_DEFINITIONS, contextFor, formatDateTime, resolveNeedToKnow, stageLabel, type Process } from '@mas/domain';
import { AgencyMark, IconButton, Pill, RiskBand } from '@mas/ui';
import { Ban, Eye, FileCheck2, PanelRightClose, PanelRightOpen, Scale, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAppearance } from '@/lib/appearance';
import { useSelection } from '@/lib/selection';
import { accessForUser, fullName, membersByAgency, personById, processById, processesInvolving, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './ContextDrawer.module.css';

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.sectionTitle}>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function WhoIsInvolved({ processes }: { processes: Process[] }) {
  const data = useData();
  if (processes.length === 0) return <p className={styles.empty}>No open process. Nobody is on a case for this person yet.</p>;
  const seen = new Set<string>();
  const groups = new Map<string, Array<{ name: string; role: string; caseRole: string; contact: string; agency: Process['members'][number]['agency'] }>>();
  for (const p of processes) {
    for (const g of membersByAgency(data, p)) {
      for (const m of g.members) {
        const key = `${p.id}:${m.membership.userId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const list = groups.get(g.agency) ?? [];
        list.push({ agency: g.agency, name: m.user ? userName(m.user) : m.membership.userId, role: m.user ? ROLE_DEFINITIONS[m.user.roleId].label : '', caseRole: m.membership.caseRole, contact: m.user ? m.user.phone : '' });
        groups.set(g.agency, list);
      }
    }
  }
  return (
    <div>
      {[...groups.entries()].map(([agency, members]) => (
        <div key={agency} className={styles.agencyGroup}>
          <AgencyMark agency={agency as Process['members'][number]['agency']} />
          {members.map((m) => (
            <div key={m.name + m.caseRole} className={styles.member}>
              <span className={styles.memberName}>{m.name}</span>
              <span className={styles.memberMeta}>
                {m.caseRole}
                {m.contact ? `, ${m.contact}` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function NeedToKnow({ process }: { process: Process }) {
  const config = useConfig();
  const res = resolveNeedToKnow(contextFor(process), config.needToKnow, config.exclusions);
  return (
    <div>
      <p className={styles.empty}>
        Stage: {stageLabel(process.type, process.stage)}. Default is deny; these audiences are told.
      </p>
      {res.recipients.map((r) => (
        <div key={r.rowId} className={styles.row}>
          <span className={styles.rowLabel}>
            {r.label} ({AGENCY_SHORT[r.agency]})
          </span>
          <Pill size="sm" tone={r.detailLevel === 'full' ? 'accent' : 'outline'}>
            {DETAIL_LEVEL_LABELS[r.detailLevel]}
          </Pill>
          <span className={styles.rowReason}>
            {r.reason} {r.fields ? `Fields: ${r.fields.join('; ')}.` : ''}
          </span>
        </div>
      ))}
      {res.exclusions.map((e) => (
        <div key={e.id} className={styles.exclusion}>
          <Ban size={14} aria-hidden="true" />
          <span>
            <strong>Must not receive: {e.label}.</strong> {e.reason}
            {e.liftableBy ? ` Can be lifted only by: ${e.liftableBy}.` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function LawfulBasis({ process }: { process: Process }) {
  const data = useData();
  const ids = new Set(data.sharingRecords.filter((s) => s.processId === process.id).map((s) => s.lawfulBasisId));
  const bases = data.lawfulBases.filter((b) => ids.has(b.id));
  if (bases.length === 0) return <p className={styles.empty}>No share has been recorded for this process yet.</p>;
  return (
    <div>
      {bases.map((b) => (
        <dl key={b.id} className={styles.kv}>
          <dt>Purpose</dt>
          <dd>{b.purpose}</dd>
          <dt>Article 6</dt>
          <dd>{b.article6}</dd>
          <dt>Article 9</dt>
          <dd>{b.article9Condition}</dd>
          <dt>Gateway</dt>
          <dd>{b.statutoryGateway.join('; ')}</dd>
          <dt>Necessity</dt>
          <dd>{b.necessityAndProportionality}</dd>
          <dt>Consent</dt>
          <dd>{b.consentStatus.replace(/-/g, ' ')}</dd>
          <dt>Authorised by</dt>
          <dd>{b.authorisedByName}</dd>
        </dl>
      ))}
    </div>
  );
}

function AuditTrail({ processIds, personId }: { processIds: string[]; personId?: string }) {
  const data = useData();
  const entries = data.audit.filter((a) => (a.processId && processIds.includes(a.processId)) || (personId && a.targetType === 'person' && a.targetId === personId)).slice(0, 8);
  if (entries.length === 0) return <p className={styles.empty}>No reads recorded yet.</p>;
  return (
    <div>
      {entries.map((a) => (
        <div key={a.id} className={styles.auditItem}>
          <span className={styles.auditTime}>{formatDateTime(a.at)}</span>
          <span className={styles.auditText}>
            {a.userName} ({AGENCY_SHORT[a.agency]}): {a.act.replace(/-/g, ' ')}
            {a.restricted ? ' (restricted)' : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function YourAccess({ process }: { process: Process }) {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const grants = useAppStore((s) => s.session.breakGlass);
  const now = useNow();
  if (!user) return null;
  const access = accessForUser(data, config, user, process, grants, now);
  const level = access.level === 'none' ? 'No access' : DETAIL_LEVEL_LABELS[access.level];
  return (
    <div className={styles.access}>
      <span className={styles.accessLevel}>
        <Eye size={14} aria-hidden="true" /> {level}
        {access.restricted ? <Pill size="sm" tone="restricted">Restricted</Pill> : null}
      </span>
      <span>{access.reason}</span>
      {access.fields.length > 0 ? <span>Fields: {access.fields.join('; ')}.</span> : null}
      {access.lawfulBasisHints.length > 0 ? <span className={styles.empty}>Basis: {access.lawfulBasisHints.join(' ')}</span> : null}
    </div>
  );
}

export function ContextDrawer() {
  const collapsed = useAppearance((s) => s.drawerCollapsed);
  const toggle = useAppearance((s) => s.toggleDrawer);
  const selection = useSelection((s) => s.selection);
  const data = useData();
  const user = useCurrentUser();

  let title = 'Context';
  let body: ReactNode = null;

  if (selection?.kind === 'person') {
    const person = personById(data, selection.id);
    const processes = person ? processesInvolving(data, person.id).filter((p) => p.status === 'open') : [];
    title = person ? fullName(person) : 'Person';
    body = (
      <>
        <Section title="Who is involved" icon={<Users size={14} aria-hidden="true" />}>
          <WhoIsInvolved processes={processes} />
        </Section>
        {processes.map((p) => (
          <Section key={p.id} title={`Need to know: ${p.reference}`} icon={<FileCheck2 size={14} aria-hidden="true" />}>
            <YourAccess process={p} />
            <NeedToKnow process={p} />
          </Section>
        ))}
        <Section title="Audit" icon={<Scale size={14} aria-hidden="true" />}>
          <AuditTrail processIds={processes.map((p) => p.id)} personId={person?.id} />
        </Section>
      </>
    );
  } else if (selection?.kind === 'process') {
    const process = processById(data, selection.id);
    title = process ? process.reference : 'Process';
    body = process ? (
      <>
        <Section title="Your access" icon={<Eye size={14} aria-hidden="true" />}>
          <YourAccess process={process} />
        </Section>
        <Section title="Who is involved" icon={<Users size={14} aria-hidden="true" />}>
          <WhoIsInvolved processes={[process]} />
        </Section>
        <Section title="Need to know at this stage" icon={<FileCheck2 size={14} aria-hidden="true" />}>
          <NeedToKnow process={process} />
        </Section>
        <Section title="Lawful basis" icon={<Scale size={14} aria-hidden="true" />}>
          <LawfulBasis process={process} />
        </Section>
        <Section title="Audit" icon={<Scale size={14} aria-hidden="true" />}>
          <AuditTrail processIds={[process.id]} />
        </Section>
      </>
    ) : null;
  } else if (selection?.kind === 'event') {
    const ev = data.events.find((e) => e.id === selection.id);
    const basis = ev?.lawfulBasisId ? data.lawfulBases.find((b) => b.id === ev.lawfulBasisId) : undefined;
    title = 'Event';
    body = ev ? (
      <>
        <Section title="Event" icon={<FileCheck2 size={14} aria-hidden="true" />}>
          <dl className={styles.kv}>
            <dt>Title</dt>
            <dd>{ev.title}</dd>
            <dt>When</dt>
            <dd>
              {formatDateTime(ev.occurredAt)}
              {ev.approximate ? ' (approximate)' : ''}
            </dd>
            <dt>Agency</dt>
            <dd>
              <AgencyMark agency={ev.agency} />
            </dd>
            <dt>Source</dt>
            <dd>{ev.sourceSystem === 'manual' ? `Recorded by ${ev.recordedByName}` : `${ev.sourceSystem} connector`}</dd>
            <dt>Significance</dt>
            <dd>
              <RiskBand band={ev.significance === 'high' ? 'high' : ev.significance === 'moderate' ? 'medium' : 'low'} label={ev.significance} />
            </dd>
            <dt>Visibility</dt>
            <dd>{ev.visibility.replace(/-/g, ' ')}</dd>
            {ev.response ? (
              <>
                <dt>Response</dt>
                <dd>{ev.response}</dd>
              </>
            ) : null}
            {ev.outcome ? (
              <>
                <dt>Outcome</dt>
                <dd>{ev.outcome}</dd>
              </>
            ) : null}
          </dl>
        </Section>
        <Section title="Lawful basis for inclusion" icon={<Scale size={14} aria-hidden="true" />}>
          {basis ? (
            <dl className={styles.kv}>
              <dt>Purpose</dt>
              <dd>{basis.purpose}</dd>
              <dt>Gateway</dt>
              <dd>{basis.statutoryGateway.join('; ')}</dd>
              <dt>Necessity</dt>
              <dd>{basis.necessityAndProportionality}</dd>
            </dl>
          ) : (
            <p className={styles.empty}>Single-agency record. No sharing basis needed until it is promoted to the integrated chronology.</p>
          )}
        </Section>
        <Section title="Versions" icon={<Scale size={14} aria-hidden="true" />}>
          {ev.versions.map((v, i) => (
            <div key={i} className={styles.auditItem}>
              <span className={styles.auditTime}>{formatDateTime(v.at)}</span>
              <span className={styles.auditText}>
                {v.byName}: {v.change}
              </span>
            </div>
          ))}
        </Section>
      </>
    ) : null;
  } else {
    title = 'Your access';
    body = user ? (
      <Section title="Signed in as" icon={<Eye size={14} aria-hidden="true" />}>
        <dl className={styles.kv}>
          <dt>Name</dt>
          <dd>
            {user.givenName} {user.familyName}
          </dd>
          <dt>Role</dt>
          <dd>{ROLE_DEFINITIONS[user.roleId].label}</dd>
          <dt>Agency</dt>
          <dd>
            <AgencyMark agency={user.agency} />
          </dd>
          <dt>Cases</dt>
          <dd>{user.caseMemberships.length} open</dd>
        </dl>
        <p className={styles.empty} style={{ marginTop: 10 }}>
          Select a person, process or event and this panel shows who is involved, who needs to know, the lawful basis and the audit trail.
        </p>
      </Section>
    ) : null;
  }

  return (
    <aside className={styles.drawer} data-collapsed={collapsed ? 'true' : 'false'} aria-label="Context">
      <div className={styles.head}>
        {!collapsed ? <span className={styles.title}>{title}</span> : null}
        <IconButton aria-label={collapsed ? 'Open context panel' : 'Collapse context panel'} aria-expanded={!collapsed} onClick={toggle}>
          {collapsed ? <PanelRightOpen size={18} aria-hidden="true" /> : <PanelRightClose size={18} aria-hidden="true" />}
        </IconButton>
      </div>
      {!collapsed ? <div className={styles.body}>{body}</div> : null}
    </aside>
  );
}
