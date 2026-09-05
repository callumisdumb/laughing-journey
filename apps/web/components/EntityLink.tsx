'use client';

import { isExcludedParty, exclusionPartyLabel, type Person, type Process, type User } from '@mas/domain';
import { useT } from '@mas/messages';
import { Ban } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { fullName, personById, userById, userName } from '@/lib/selectors';
import { practitionerPath, personPath, processPath } from '@/lib/routes';
import { useConfig, useData } from '@/lib/store';
import styles from './EntityLink.module.css';

/**
 * A named person, as a link to their record.
 *
 * Two rules decide whether the name is a link, and both are about honesty rather than convenience.
 *
 * **A link a reader is not entitled to follow looks exactly like one they are.** It has to: a link
 * that is styled differently, or missing, when the reader has no access tells them something about
 * the record before they have asked, and the audit trail records nothing because nothing happened.
 * Following it lands on the presence-only state, which says a record exists, that this reader may
 * not read it, and how to ask, and that read is audited. That is the difference between a system
 * that refuses and a system that hides, and only the first can be inspected afterwards.
 *
 * **An excluded party is never a link.** Where a process is in scope and the exclusion register says
 * this person must not receive information about it, their name renders as a marked entry instead.
 * A link would put a route into their record next to the reason they must not be given one, which is
 * an invitation misfiled as a convenience.
 */
export function PersonLink({
  person,
  personId,
  process,
  children,
  className,
}: {
  person?: Person;
  personId?: string;
  /** The case being read, where there is one. Exclusions are per process, stage and party role. */
  process?: Process;
  children?: ReactNode;
  className?: string;
}) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const resolved = person ?? (personId ? personById(data, personId) : undefined);

  // A name with no record behind it: a referrer typed on a form, a relative nobody has opened a
  // record for. Plain text, because there is nowhere to go.
  if (!resolved) return <span className={className}>{children ?? personId ?? ''}</span>;

  const excluded = process ? isExcludedParty(process, { personId: resolved.id }, config.exclusions, process.stage, data.relationships) : null;
  if (excluded) {
    return (
      <span className={className} data-excluded="true" title={t('links.excluded.title', { party: exclusionPartyLabel(excluded.party.party), reason: excluded.exclusion.reason })}>
        <Ban size={13} aria-hidden="true" className={styles.banned} />
        {children ?? fullName(resolved)}
        <span className="visually-hidden">{t('links.excluded.readAfterName', { party: exclusionPartyLabel(excluded.party.party) })}</span>
      </span>
    );
  }

  return (
    <AppLink href={personPath(resolved.id)} className={className}>
      {children ?? fullName(resolved)}
    </AppLink>
  );
}

/**
 * A practitioner, as a link to their card: who they are, which agency, which cases they are on and
 * how to reach them. Every entry is in the seed already and was previously only ever shown as a name
 * beside a role, which meant "who is this person and can I ring them" was answered by scrolling.
 */
export function PractitionerLink({ user, userId, children, className }: { user?: User; userId?: string; children?: ReactNode; className?: string }) {
  const data = useData();
  const resolved = user ?? (userId ? userById(data, userId) : undefined);
  if (!resolved) return <span className={className}>{children ?? userId ?? ''}</span>;
  return (
    <AppLink href={practitionerPath(resolved.id)} className={className}>
      {children ?? userName(resolved)}
    </AppLink>
  );
}

/**
 * A case reference, as a link to its process. References are how practitioners actually talk about
 * cases to each other, so a reference read anywhere in the product should go to the case it names.
 */
export function ProcessRef({ process, children, className }: { process: Process; children?: ReactNode; className?: string }) {
  return (
    <AppLink href={processPath(process.id)} className={className}>
      {children ?? process.reference}
    </AppLink>
  );
}
