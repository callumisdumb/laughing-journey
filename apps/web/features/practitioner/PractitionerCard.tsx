'use client';

import { agencyLabel, processShort, roleLabel, stageLabel } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark, EmptyState, KeyValue, ProcessMark, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { useEffect } from 'react';
import { AppLink } from '@/components/AppLink';
import { PersonLink, ProcessRef } from '@/components/EntityLink';
import { accessForUser, fullName, personById, userById, userName } from '@/lib/selectors';
import { practitionerPath } from '@/lib/routes';
import { useTrail } from '@/lib/trail';
import { useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import styles from './PractitionerCard.module.css';

/**
 * Who a practitioner is, which cases they hold and how to reach them.
 *
 * Every one of these fields was already in the seed and none of them had a screen: a practitioner
 * appeared as a name beside a case role and nothing else, so "who is the MHO on this and can I ring
 * them" was answered by scrolling a members list and then by not being answered at all. That is a
 * gap the demo shows off badly, because multi-agency working is the point and the other agency's
 * worker is the person you actually need.
 *
 * The case list is filtered by the reader's own access, not the practitioner's. A card that listed
 * every case a colleague holds would be a way round need-to-know that took one click and left the
 * same audit trail as reading a staff directory.
 */
export function PractitionerCard({ userId }: { userId: string }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const viewer = useCurrentUser();
  const grants = useGrants();
  const visit = useTrail((s) => s.visit);
  const subject = userById(data, userId);

  useEffect(() => {
    if (subject) visit({ kind: 'practitioner', id: subject.id, label: userName(subject), path: practitionerPath(subject.id) });
  }, [subject, visit]);

  if (!subject) {
    return <EmptyState title={t('practitioner.notFound.title')} text={t('practitioner.notFound.text')} actions={<AppLink href="/people">{t('practitioner.notFound.back')}</AppLink>} />;
  }

  const organisation = data.organisations.find((o) => o.id === subject.organisationId);
  const team = subject.teamId ? data.teams.find((x) => x.id === subject.teamId) : undefined;

  // Their cases, seen through the reader's access rather than theirs.
  const cases = viewer
    ? data.processes
        .filter((p) => p.members.some((m) => m.userId === subject.id))
        .map((p) => ({ process: p, access: accessForUser(data, config, viewer, p, grants, now), membership: p.members.find((m) => m.userId === subject.id)! }))
        .filter((c) => c.access.level !== 'none')
    : [];
  const withheld = viewer ? data.processes.filter((p) => p.members.some((m) => m.userId === subject.id)).length - cases.length : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <p className={styles.eyebrow}>{t('practitioner.eyebrow')}</p>
          <h1>{userName(subject)}</h1>
          <p className="page-lede">{subject.blurb}</p>
        </div>
        <AgencyMark agency={subject.agency} />
      </div>

      <div className={styles.columns}>
        <Sheet>
          <SheetHead title={t('practitioner.who.title')} meta={t('practitioner.who.meta')} divided />
          <SheetBody>
            <KeyValue
              items={[
                { key: t('practitioner.fields.role'), value: roleLabel(subject.roleId) },
                { key: t('practitioner.fields.jobTitle'), value: subject.jobTitle },
                { key: t('practitioner.fields.agency'), value: agencyLabel(subject.agency) },
                { key: t('practitioner.fields.organisation'), value: organisation?.name ?? subject.organisationId },
                ...(team ? [{ key: t('practitioner.fields.team'), value: team.name }] : []),
                { key: t('practitioner.fields.base'), value: subject.base },
              ]}
            />
          </SheetBody>
        </Sheet>

        <Sheet>
          <SheetHead title={t('practitioner.contact.title')} meta={t('practitioner.contact.meta')} divided />
          <SheetBody>
            <KeyValue
              items={[
                { key: t('practitioner.fields.phone'), value: subject.phone },
                { key: t('practitioner.fields.email'), value: subject.email },
              ]}
            />
          </SheetBody>
        </Sheet>
      </div>

      <Sheet>
        <SheetHead
          title={t('practitioner.cases.title')}
          meta={withheld > 0 ? t('practitioner.cases.metaWithheld', { count: cases.length, withheld }) : t('practitioner.cases.meta', { count: cases.length })}
          divided
        />
        <SheetBody>
          {cases.length === 0 ? <p className={styles.empty}>{t('practitioner.cases.empty')}</p> : null}
          {cases.map(({ process, membership, access }) => {
            const subjectPerson = process.subjectIds[0] ? personById(data, process.subjectIds[0]) : undefined;
            return (
              <div key={process.id} className={styles.caseRow}>
                <ProcessMark type={process.type} stage={stageLabel(process.type, process.stage)} restricted={process.accessRestriction === 'restricted'} />
                <span className={styles.caseTitle}>
                  <ProcessRef process={process} /> {processShort(process.type)}
                  {subjectPerson ? (
                    <>
                      {': '}
                      <PersonLink person={subjectPerson} process={process}>
                        {fullName(subjectPerson)}
                      </PersonLink>
                    </>
                  ) : null}
                </span>
                <span className={styles.caseRole}>{membership.caseRole}</span>
                {access.level !== 'full' ? <span className={styles.caseLimited}>{t('practitioner.cases.limited')}</span> : null}
              </div>
            );
          })}
        </SheetBody>
      </Sheet>
    </div>
  );
}
