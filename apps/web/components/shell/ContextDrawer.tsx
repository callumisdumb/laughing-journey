'use client';

import { accessRestrictionLabel, actionStatusLabel, identifiesSubject, agencyShort, classificationLabel, effectiveClassification, formatDate, analysisKindLabel, attendanceLabel, channelLabel, classificationFor, consentStatusLabel, contextFor, detailLevelLabel, exclusionPartyLabel, formatDateTime, partyRegister, recipientView, resolveNeedToKnow, roleLabel, shareStatusLabel, significanceLabel, stageLabel, marking, visibilityLabel, type CaseParty, type Config, type ClassifiedRecord, type Process } from '@mas/domain';
import { useT, type Translator } from '@mas/messages';
import { AgencyMark, Dialog, IconButton, Pill, RiskBand } from '@mas/ui';
import { ArrowRight, Ban, Bell, Eye, FileCheck2, PanelRightClose, PanelRightOpen, Scale, ShieldCheck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { PractitionerLink } from '@/components/EntityLink';
import { NotificationList } from '@/components/notifications/NotificationList';
import { useNotifications } from '@/components/notifications/useNotifications';
import { useAppearance } from '@/lib/appearance';
import { useSelection } from '@/lib/selection';
import { accessForUser, fullName, membersByAgency, personById, processById, processesInvolving, userById, userName } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import { useTransitionsNarrative } from '@/features/process/transitions/TransitionPanel';
import styles from './ContextDrawer.module.css';

/**
 * The Annex 2 marking of a recorded lawful basis, read as text so a screen reader gets it in the row
 * rather than only as a tag. Official has no marking, so the row says so rather than sitting empty.
 */
function classificationSummary(config: Config, record: ClassifiedRecord, t: Translator): string {
  return marking(classificationFor(config, record)) ?? t('nav.drawer.fields.noMarking');
}

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
  const t = useT();
  const data = useData();
  if (processes.length === 0) return <p className={styles.empty}>{t('nav.drawer.involved.empty')}</p>;
  const seen = new Set<string>();
  const groups = new Map<string, Array<{ userId: string; name: string; role: string; caseRole: string; contact: string; agency: Process['members'][number]['agency'] }>>();
  for (const p of processes) {
    for (const g of membersByAgency(data, p)) {
      for (const m of g.members) {
        const key = `${p.id}:${m.membership.userId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const list = groups.get(g.agency) ?? [];
        list.push({ agency: g.agency, userId: m.membership.userId, name: m.user ? userName(m.user) : m.membership.userId, role: m.user ? roleLabel(m.user.roleId) : '', caseRole: m.membership.caseRole, contact: m.user ? m.user.phone : '' });
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
              <span className={styles.memberName}>
                <PractitionerLink userId={m.userId}>{m.name}</PractitionerLink>
              </span>
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
  const t = useT();
  const data = useData();
  const config = useConfig();
  const res = resolveNeedToKnow(contextFor(process), config.needToKnow, config.exclusions);
  // The case-role register: who actually holds each excluded party role on this process.
  const register = partyRegister(process, data.relationships);
  const partyName = (p: CaseParty): string | undefined => {
    const person = personById(data, p.personId);
    if (person) return fullName(person);
    const u = userById(data, p.userId);
    if (u) return userName(u);
    // Recorded by name on a referral form: there is no record or account to look up.
    return p.name;
  };
  return (
    <div>
      <p className={styles.empty}>{t('nav.drawer.needToKnow.stage', { stage: stageLabel(process.type, process.stage) })}</p>
      {res.recipients.map((r) => (
        <div key={r.rowId} className={styles.row}>
          <span className={styles.rowLabel}>
            {r.label} ({agencyShort(r.agency)})
          </span>
          <Pill size="sm" tone={r.detailLevel === 'full' ? 'accent' : 'outline'}>
            {detailLevelLabel(r.detailLevel)}
          </Pill>
          <span className={styles.rowReason}>
            {r.reason} {r.fields ? t('nav.drawer.needToKnow.fields', { fields: r.fields.join('; ') }) : ''}
          </span>
        </div>
      ))}
      {res.exclusions.map((e) => {
        const holders = register.filter((p) => p.party === e.party);
        const liftable = e.liftableBy ? t('nav.drawer.needToKnow.liftableBy', { by: e.liftableBy }) : undefined;
        if (holders.length === 0) {
          return (
            <div key={e.id} className={styles.exclusion}>
              <Ban size={14} aria-hidden="true" />
              <span>
                <strong>{t('nav.drawer.needToKnow.mustNotReceive', { who: e.label })}</strong> {t('nav.drawer.needToKnow.nobodyRecorded', { reason: e.reason })}
                {liftable ? (
                  <>
                    {' '}
                    {liftable}
                  </>
                ) : null}
              </span>
            </div>
          );
        }
        return holders.map((p) => {
          const who = partyName(p);
          const notes = [who ? p.label : undefined, p.reason ?? e.reason].filter(Boolean).join('. ');
          return (
            <div key={`${e.id}:${p.personId ?? p.userId ?? p.name ?? p.label}`} className={styles.exclusion}>
              <Ban size={14} aria-hidden="true" />
              <span>
                <strong>{t('nav.drawer.needToKnow.mustNotReceiveParty', { who: who ?? p.label, party: exclusionPartyLabel(p.party) })}</strong> {t('nav.drawer.needToKnow.source', { notes, source: p.source })}
                {liftable ? (
                  <>
                    {' '}
                    {liftable}
                  </>
                ) : null}
              </span>
            </div>
          );
        });
      })}
    </div>
  );
}

function LawfulBasis({ process }: { process: Process }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const ids = new Set(data.sharingRecords.filter((s) => s.processId === process.id).map((s) => s.lawfulBasisId));
  const bases = data.lawfulBases.filter((b) => ids.has(b.id));
  if (bases.length === 0) return <p className={styles.empty}>{t('nav.drawer.lawfulBasis.empty')}</p>;
  return (
    <div>
      {bases.map((b) => (
        <dl key={b.id} className={styles.kv}>
          <dt>{t('nav.drawer.fields.purpose')}</dt>
          <dd>{b.purpose}</dd>
          <dt>{t('nav.drawer.fields.article6')}</dt>
          <dd>{b.article6}</dd>
          <dt>{t('nav.drawer.fields.article9')}</dt>
          <dd>{b.article9Condition}</dd>
          <dt>{t('nav.drawer.fields.classification')}</dt>
          <dd>{classificationSummary(config, b, t)}</dd>
          <dt>{t('nav.drawer.fields.gateway')}</dt>
          <dd>{b.statutoryGateway.join('; ')}</dd>
          <dt>{t('nav.drawer.fields.necessity')}</dt>
          <dd>{b.necessityAndProportionality}</dd>
          <dt>{t('nav.drawer.fields.consent')}</dt>
          <dd>{consentStatusLabel(b.consentStatus)}</dd>
          <dt>{t('nav.drawer.fields.authorisedBy')}</dt>
          <dd>{b.authorisedByName}</dd>
        </dl>
      ))}
    </div>
  );
}

function AuditTrail({ processIds, personId }: { processIds: string[]; personId?: string }) {
  const t = useT();
  const data = useData();
  const entries = data.audit.filter((a) => (a.processId && processIds.includes(a.processId)) || (personId && a.targetType === 'person' && a.targetId === personId)).slice(0, 8);
  if (entries.length === 0) return <p className={styles.empty}>{t('nav.drawer.audit.empty')}</p>;
  return (
    <div>
      {entries.map((a) => {
        const args = { user: a.userName, agency: agencyShort(a.agency), act: a.act.replace(/-/g, ' ') };
        return (
          <div key={a.id} className={styles.auditItem}>
            <span className={styles.auditTime}>{formatDateTime(a.at)}</span>
            <span className={styles.auditText}>{a.restricted ? t('nav.drawer.audit.entryRestricted', args) : t('nav.drawer.audit.entry', args)}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The record's marking, and whether a person put it there. A reader needs to know that a raised
 * marking was a decision rather than a derivation, and whose decision it was.
 */
function ProcessClassification({ process }: { process: Process }) {
  const t = useT();
  const config = useConfig();
  const effective = effectiveClassification(config, process);
  return (
    <dl className={styles.kv}>
      <dt>{t('nav.drawer.fields.classification')}</dt>
      <dd>{marking(effective.classification) ?? t('nav.drawer.fields.noMarking')}</dd>
      <dt>{t('nav.drawer.fields.accessRestriction')}</dt>
      <dd>{accessRestrictionLabel(process.accessRestriction)}</dd>
      {effective.override ? (
        <>
          <dt>{t('nav.drawer.fields.classificationSetBy')}</dt>
          <dd>
            {t('nav.drawer.share.overrideNote', {
              direction: effective.override.direction,
              derived: classificationLabel(effective.derived),
              name: effective.override.byName,
              date: formatDate(effective.override.at),
              reason: effective.override.reason,
            })}
          </dd>
        </>
      ) : null}
    </dl>
  );
}

function YourAccess({ process }: { process: Process }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const grants = useGrants();
  const now = useNow();
  if (!user) return null;
  const access = accessForUser(data, config, user, process, grants, now);
  const level = access.level === 'none' ? t('nav.drawer.access.none') : detailLevelLabel(access.level);
  return (
    <div className={styles.access}>
      <span className={styles.accessLevel}>
        <Eye size={14} aria-hidden="true" /> {level}
        {access.restricted ? <Pill size="sm" tone="restricted">{t('common.labels.restricted')}</Pill> : null}
      </span>
      <span>{access.reason}</span>
      {access.fields.length > 0 ? <span>{t('nav.drawer.needToKnow.fields', { fields: access.fields.join('; ') })}</span> : null}
      {access.lawfulBasisHints.length > 0 ? <span className={styles.empty}>{t('nav.drawer.access.basis', { hints: access.lawfulBasisHints.join(' ') })}</span> : null}
    </div>
  );
}

/**
 * The process panel, gated on the same predicate the record itself is.
 *
 * Two sections are about the reader rather than about the case: what level they hold and why, and
 * the marking that governs how they may pass it on. Everything below those is written about the
 * case, and on a MARAC that is the whole difficulty. The purpose sentence names the victim. The
 * exclusion list names the person who must not receive it, which is worse. The reads name the
 * practitioners who are on it. A drawer that showed those beside a header that had just refused to
 * name the case would have refused nothing, and the drawer is the screen a reader trusts for the
 * need-to-know answer, so getting it wrong here is worse than getting it wrong anywhere else.
 */
function ProcessDrawer({ process }: { process: Process }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const grants = useGrants();
  const now = useNow();
  const level = user ? accessForUser(data, config, user, process, grants, now).level : 'none';
  return (
    <>
      <Section title={t('nav.drawer.section.yourAccess')} icon={<Eye size={14} aria-hidden="true" />}>
        <YourAccess process={process} />
      </Section>
      <Section title={t('nav.drawer.section.classification')} icon={<ShieldCheck size={14} aria-hidden="true" />}>
        <ProcessClassification process={process} />
      </Section>
      {/*
        What this person has been told about this case. Shown at every level, because each line was
        written at the level its recipient holds: a presence-level reader sees that the case changed
        and nothing else, which is exactly what they were told.
      */}
      <Section title={t('nav.drawer.section.notifications')} icon={<Bell size={14} aria-hidden="true" />}>
        <ProcessNotifications processId={process.id} />
      </Section>
      {/*
        What the stage engine offers next (D-217), as sentences: what each decision is, where it
        leads, whether it is this person's to record and what it waits for. The panel on the case
        has the buttons; the drawer says the same thing on any screen the case is selected from.
      */}
      {level === 'full' ? (
        <Section title={t('nav.drawer.section.next')} icon={<ArrowRight size={14} aria-hidden="true" />}>
          <WhatHappensNext process={process} />
        </Section>
      ) : null}
      {identifiesSubject(level) ? (
        <>
          <Section title={t('nav.drawer.section.whoIsInvolved')} icon={<Users size={14} aria-hidden="true" />}>
            <WhoIsInvolved processes={[process]} />
          </Section>
          <Section title={t('nav.drawer.section.needToKnowStage')} icon={<FileCheck2 size={14} aria-hidden="true" />}>
            <NeedToKnow process={process} />
          </Section>
          <Section title={t('nav.drawer.section.lawfulBasis')} icon={<Scale size={14} aria-hidden="true" />}>
            <LawfulBasis process={process} />
          </Section>
          <Section title={t('nav.drawer.section.audit')} icon={<Scale size={14} aria-hidden="true" />}>
            <AuditTrail processIds={[process.id]} />
          </Section>
        </>
      ) : (
        <p className={styles.withheld}>{t('nav.drawer.process.withheld')}</p>
      )}
    </>
  );
}

function WhatHappensNext({ process }: { process: Process }) {
  const t = useT();
  const sentences = useTransitionsNarrative(process);
  if (sentences.length === 0) return <p className={styles.empty}>{t('nav.drawer.next.none')}</p>;
  return (
    <ul className={styles.plain} data-testid="drawer-next">
      {sentences.map((sentence) => (
        <li key={sentence}>{sentence}</li>
      ))}
    </ul>
  );
}

function ProcessNotifications({ processId }: { processId: string }) {
  const t = useT();
  const { items, open } = useNotifications();
  const mine = items.filter((i) => i.processId === processId).slice(0, 5);
  return (
    <div data-testid="drawer-notifications">
      <NotificationList items={mine} onOpen={open} emptyText={t('nav.drawer.notifications.empty')} />
    </div>
  );
}

/**
 * What the drawer is showing, built once and used by both shapes it takes.
 *
 * The drawer is a docked third column while there is room for one and a panel over the record when
 * there is not, and the two must show exactly the same thing: the need-to-know answer for the
 * current selection is the point of the drawer, and a version of it that is different at 1200px
 * would be a second implementation of the access rules. So the content is computed here and the
 * shape is chosen by the layout mode.
 */
function useDrawerContent(): { title: string; body: ReactNode } {
  const t = useT();
  const selection = useSelection((s) => s.selection);
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();

  let title: string;
  let body: ReactNode = null;

  if (selection?.kind === 'person') {
    const person = personById(data, selection.id);
    const processes = person ? processesInvolving(data, person.id).filter((p) => p.status === 'open') : [];
    title = person ? fullName(person) : t('nav.drawer.title.person');
    body = (
      <>
        <Section title={t('nav.drawer.section.whoIsInvolved')} icon={<Users size={14} aria-hidden="true" />}>
          <WhoIsInvolved processes={processes} />
        </Section>
        {processes.map((p) => (
          <Section key={p.id} title={t('nav.drawer.section.needToKnowFor', { reference: p.reference })} icon={<FileCheck2 size={14} aria-hidden="true" />}>
            <YourAccess process={p} />
            <NeedToKnow process={p} />
          </Section>
        ))}
        <Section title={t('nav.drawer.section.audit')} icon={<Scale size={14} aria-hidden="true" />}>
          <AuditTrail processIds={processes.map((p) => p.id)} personId={person?.id} />
        </Section>
      </>
    );
  } else if (selection?.kind === 'process') {
    const process = processById(data, selection.id);
    title = process ? process.reference : t('nav.drawer.title.process');
    body = process ? <ProcessDrawer process={process} /> : null;
  } else if (selection?.kind === 'event') {
    const ev = data.events.find((e) => e.id === selection.id);
    const basis = ev?.lawfulBasisId ? data.lawfulBases.find((b) => b.id === ev.lawfulBasisId) : undefined;
    title = t('nav.drawer.title.event');
    body = ev ? (
      <>
        <Section title={t('nav.drawer.section.event')} icon={<FileCheck2 size={14} aria-hidden="true" />}>
          <dl className={styles.kv}>
            <dt>{t('nav.drawer.fields.title')}</dt>
            <dd>{ev.title}</dd>
            <dt>{t('nav.drawer.fields.when')}</dt>
            <dd>{ev.approximate ? t('nav.drawer.event.whenApproximate', { when: formatDateTime(ev.occurredAt) }) : formatDateTime(ev.occurredAt)}</dd>
            <dt>{t('nav.drawer.fields.agency')}</dt>
            <dd>
              <AgencyMark agency={ev.agency} />
            </dd>
            <dt>{t('nav.drawer.fields.source')}</dt>
            <dd>{ev.sourceSystem === 'manual' ? t('nav.drawer.event.recordedBy', { name: ev.recordedByName }) : t('nav.drawer.event.connector', { system: ev.sourceSystem })}</dd>
            <dt>{t('nav.drawer.fields.significance')}</dt>
            <dd>
              <RiskBand band={ev.significance === 'high' ? 'high' : ev.significance === 'moderate' ? 'medium' : 'low'} label={significanceLabel(ev.significance)} />
            </dd>
            <dt>{t('nav.drawer.fields.visibility')}</dt>
            <dd>{visibilityLabel(ev.visibility)}</dd>
            {ev.response ? (
              <>
                <dt>{t('nav.drawer.fields.response')}</dt>
                <dd>{ev.response}</dd>
              </>
            ) : null}
            {ev.outcome ? (
              <>
                <dt>{t('nav.drawer.fields.outcome')}</dt>
                <dd>{ev.outcome}</dd>
              </>
            ) : null}
          </dl>
        </Section>
        <Section title={t('nav.drawer.section.lawfulBasisInclusion')} icon={<Scale size={14} aria-hidden="true" />}>
          {basis ? (
            <dl className={styles.kv}>
              <dt>{t('nav.drawer.fields.purpose')}</dt>
              <dd>{basis.purpose}</dd>
              <dt>{t('nav.drawer.fields.gateway')}</dt>
              <dd>{basis.statutoryGateway.join('; ')}</dd>
              <dt>{t('nav.drawer.fields.necessity')}</dt>
              <dd>{basis.necessityAndProportionality}</dd>
            </dl>
          ) : (
            <p className={styles.empty}>{t('nav.drawer.lawfulBasis.singleAgency')}</p>
          )}
        </Section>
        <Section title={t('nav.drawer.section.versions')} icon={<Scale size={14} aria-hidden="true" />}>
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
  } else if (selection?.kind === 'meeting') {
    const m = data.meetings.find((x) => x.id === selection.id);
    title = m ? m.title : t('nav.drawer.title.meeting');
    body = m ? (
      <>
        <Section title={t('nav.drawer.section.invitees')} icon={<Users size={14} aria-hidden="true" />}>
          {m.invitees.map((i, idx) => (
            <div key={`${i.name}-${idx}`} className={styles.member} style={{ paddingLeft: 0 }}>
              <span className={styles.memberName}>
                <AgencyMark agency={i.agency} hideLabel /> {i.name}, {i.role} ({attendanceLabel(i.attendance)})
              </span>
              <span className={styles.memberMeta}>{i.reason}</span>
            </div>
          ))}
        </Section>
        <Section title={t('nav.drawer.section.distribution')} icon={<FileCheck2 size={14} aria-hidden="true" />}>
          {m.distribution.length === 0 ? <p className={styles.empty}>{t('nav.drawer.meeting.noDistribution')}</p> : null}
          {m.distribution.map((d) => (
            <div key={d.id} className={styles.row}>
              <span className={styles.rowLabel}>{d.recipientName}</span>
              <Pill size="sm" tone={d.detailLevel === 'full' ? 'accent' : 'outline'}>
                {detailLevelLabel(d.detailLevel)}
              </Pill>
              <span className={styles.rowReason}>{d.reason}</span>
            </div>
          ))}
        </Section>
      </>
    ) : null;
  } else if (selection?.kind === 'action') {
    const a = data.actions.find((x) => x.id === selection.id);
    const p = a ? data.processes.find((x) => x.id === a.processId) : undefined;
    title = t('nav.drawer.title.action');
    body = a ? (
      <Section title={t('nav.drawer.section.action')} icon={<FileCheck2 size={14} aria-hidden="true" />}>
        <dl className={styles.kv}>
          <dt>{t('nav.drawer.fields.action')}</dt>
          <dd>{a.title}</dd>
          <dt>{t('nav.drawer.fields.owner')}</dt>
          <dd>
            {a.ownerName} (<AgencyMark agency={a.ownerAgency} />)
          </dd>
          <dt>{t('nav.drawer.fields.due')}</dt>
          <dd>{formatDateTime(a.due + 'T09:00:00+01:00').slice(0, 11)}</dd>
          <dt>{t('nav.drawer.fields.status')}</dt>
          <dd>{actionStatusLabel(a.status)}</dd>
          <dt>{t('nav.drawer.fields.process')}</dt>
          <dd>{p ? `${p.reference}: ${p.title}` : ''}</dd>
          {a.evidence ? (
            <>
              <dt>{t('nav.drawer.fields.evidence')}</dt>
              <dd>{a.evidence}</dd>
            </>
          ) : null}
        </dl>
      </Section>
    ) : null;
  } else if (selection?.kind === 'analysis') {
    const an = data.analyses.find((a) => a.id === selection.id);
    title = t('nav.drawer.title.analysis');
    body = an ? (
      <>
        <Section title={t('nav.drawer.section.judgement')} icon={<FileCheck2 size={14} aria-hidden="true" />}>
          <dl className={styles.kv}>
            <dt>{t('nav.drawer.fields.title')}</dt>
            <dd>{an.title}</dd>
            <dt>{t('nav.drawer.fields.kind')}</dt>
            <dd>{analysisKindLabel(an.kind)}</dd>
            <dt>{t('nav.drawer.fields.author')}</dt>
            <dd>
              {an.authorName} (<AgencyMark agency={an.agency} />)
            </dd>
            <dt>{t('nav.drawer.fields.recorded')}</dt>
            <dd>{formatDateTime(an.recordedAt)}</dd>
            <dt>{t('nav.drawer.fields.text')}</dt>
            <dd>{an.text}</dd>
          </dl>
        </Section>
        <Section title={t('nav.drawer.section.restsOn', { count: an.eventIds.length })} icon={<Scale size={14} aria-hidden="true" />}>
          {an.eventIds.map((id) => {
            const ev = data.events.find((e) => e.id === id);
            return ev ? (
              <div key={id} className={styles.auditItem}>
                <span className={styles.auditTime}>{formatDateTime(ev.occurredAt)}</span>
                <span className={styles.auditText}>{ev.title}</span>
              </div>
            ) : null;
          })}
        </Section>
      </>
    ) : null;
  } else if (selection?.kind === 'share') {
    const s = data.sharingRecords.find((x) => x.id === selection.id);
    const basis = s ? data.lawfulBases.find((b) => b.id === s.lawfulBasisId) : undefined;
    const recipientRole = s?.recipient.userId ? data.users.find((u) => u.id === s.recipient.userId)?.roleId : undefined;
    title = t('nav.drawer.title.share');
    body = s ? (
      <>
        <Section title={t('nav.drawer.section.recipient')} icon={<Users size={14} aria-hidden="true" />}>
          <dl className={styles.kv}>
            <dt>{t('nav.drawer.fields.to')}</dt>
            <dd>
              {s.recipient.name}, {s.recipient.role} (<AgencyMark agency={s.recipient.agency} />)
            </dd>
            <dt>{t('nav.drawer.fields.level')}</dt>
            <dd>{detailLevelLabel(s.detailLevel)}{s.fields ? `: ${s.fields.join('; ')}` : ''}</dd>
            <dt>{t('nav.drawer.fields.why')}</dt>
            <dd>{s.reason}</dd>
            <dt>{t('nav.drawer.fields.channel')}</dt>
            <dd>{channelLabel(s.channel)}</dd>
            <dt>{t('nav.drawer.fields.status')}</dt>
            <dd>{s.readAt ? t('nav.drawer.share.statusRead', { status: shareStatusLabel(s.status), when: formatDateTime(s.readAt) }) : shareStatusLabel(s.status)}</dd>
            <dt>{t('nav.drawer.fields.sharedUnder')}</dt>
            <dd>{classificationSummary(config, s, t)}</dd>
            <dt>{t('nav.drawer.fields.accessRestriction')}</dt>
            <dd>{accessRestrictionLabel(s.accessRestriction)}</dd>
          </dl>
          {recipientRole && !recipientView(config, s, recipientRole).showContent ? (
            <p className={styles.note}>{t('nav.drawer.share.withheldFromRecipient', { role: roleLabel(recipientRole) })}</p>
          ) : null}
        </Section>
        <Section title={t('nav.drawer.section.lawfulBasis')} icon={<Scale size={14} aria-hidden="true" />}>
          {basis ? (
            <dl className={styles.kv}>
              <dt>{t('nav.drawer.fields.purpose')}</dt>
              <dd>{basis.purpose}</dd>
              <dt>{t('nav.drawer.fields.article6')}</dt>
              <dd>{basis.article6}</dd>
              <dt>{t('nav.drawer.fields.article9')}</dt>
              <dd>{basis.article9Condition}</dd>
              <dt>{t('nav.drawer.fields.offenceData')}</dt>
              <dd>{basis.article10Criminal}</dd>
              <dt>{t('nav.drawer.fields.classification')}</dt>
              <dd>{classificationSummary(config, basis, t)}</dd>
              <dt>{t('nav.drawer.fields.gateway')}</dt>
              <dd>{basis.statutoryGateway.join('; ')}</dd>
              <dt>{t('nav.drawer.fields.necessity')}</dt>
              <dd>{basis.necessityAndProportionality}</dd>
              <dt>{t('nav.drawer.fields.consent')}</dt>
              <dd>{consentStatusLabel(basis.consentStatus)}{basis.consentNote ? `. ${basis.consentNote}` : ''}</dd>
              <dt>{t('nav.drawer.fields.authorisedBy')}</dt>
              <dd>{basis.authorisedByName}</dd>
              {basis.informationSharingAgreementRef ? (
                <>
                  <dt>{t('nav.drawer.fields.isa')}</dt>
                  <dd>{basis.informationSharingAgreementRef}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className={styles.empty}>{t('nav.drawer.lawfulBasis.notLinked')}</p>
          )}
        </Section>
      </>
    ) : null;
  } else {
    title = t('nav.drawer.title.yourAccess');
    body = user ? (
      <Section title={t('nav.drawer.section.signedIn')} icon={<Eye size={14} aria-hidden="true" />}>
        <dl className={styles.kv}>
          <dt>{t('nav.drawer.fields.name')}</dt>
          <dd>
            {user.givenName} {user.familyName}
          </dd>
          <dt>{t('nav.drawer.fields.role')}</dt>
          <dd>{roleLabel(user.roleId)}</dd>
          <dt>{t('nav.drawer.fields.agency')}</dt>
          <dd>
            <AgencyMark agency={user.agency} />
          </dd>
          <dt>{t('nav.drawer.fields.cases')}</dt>
          <dd>{t('nav.drawer.signedIn.casesOpen', { count: user.caseMemberships.length })}</dd>
        </dl>
        <p className={styles.empty} style={{ marginTop: 10 }}>
          {t('nav.drawer.signedIn.help')}
        </p>
      </Section>
    ) : null;
  }

  return { title, body };
}

/** The docked third column, in the layout modes wide enough to hold one. */
export function ContextDrawer() {
  const t = useT();
  const collapsed = useAppearance((s) => s.drawerCollapsed);
  const toggle = useAppearance((s) => s.toggleDrawer);
  const { title, body } = useDrawerContent();

  return (
    <aside className={styles.drawer} data-collapsed={collapsed ? 'true' : 'false'} aria-label={t('nav.drawer.label')}>
      <div className={styles.head}>
        {!collapsed ? <span className={styles.title}>{title}</span> : null}
        <IconButton aria-label={collapsed ? t('nav.drawer.open') : t('nav.drawer.collapse')} aria-expanded={!collapsed} onClick={toggle}>
          {collapsed ? <PanelRightOpen size={18} aria-hidden="true" /> : <PanelRightClose size={18} aria-hidden="true" />}
        </IconButton>
      </div>
      {!collapsed ? (
        <div className={styles.body} role="region" tabIndex={0} aria-label={t('nav.drawer.details', { title })}>
          {body}
        </div>
      ) : null}
    </aside>
  );
}

/**
 * The same drawer as a panel over the record, below 1280 where a third column would leave the record
 * less than half the screen. It is the dialog primitive at its `inline-end` placement rather than a
 * second overlay implementation, so it gets the top layer, focus trapped inside, Escape and the page
 * held still without any of that being written twice.
 */
export function ContextDrawerOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { title, body } = useDrawerContent();
  return (
    <Dialog open={open} onClose={onClose} title={title} placement="inline-end" size="sm" className={styles.overlay}>
      <div className={styles.overlayBody}>{body}</div>
    </Dialog>
  );
}
