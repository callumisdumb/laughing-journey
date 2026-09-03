'use client';

import { exclusionPartyLabel, formatDate, type NearMatch, type SimilarityKind } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog } from '@mas/ui';
import styles from './NearMatchDialog.module.css';

/** ICU select keys cannot carry hyphens, so the similarity kind is mapped once, here. */
const KIND_KEYS: Record<SimilarityKind, string> = {
  'same-after-normalising': 'sameAfterNormalising',
  'extra-names': 'extraNames',
  initials: 'initials',
  spelling: 'spelling',
};

/** Which list somebody is being added to. Named so the dialog and the audit entry agree. */
export type NearMatchList = 'invitees' | 'distribution' | 'request' | 'research';

export interface PendingNearMatch {
  /** The name being added, as typed or as it appears on the account. */
  name: string;
  list: NearMatchList;
  matches: NearMatch[];
  /** Run when the person confirms they are somebody else. */
  onConfirm: () => void;
}

/**
 * The confirmation that stands between a near-match name and a distribution list.
 *
 * It blocks rather than warns, and it quotes the register entry it resembles: the name as somebody
 * wrote it down, the date, the party role and the reason. A warning that only says "this looks
 * similar" gives the person nothing to decide with, and they will click through it.
 *
 * Both answers are audited by the caller, with the entry that matched, so a wrong call is traceable
 * rather than invisible. That is the part that makes this worth having: the register stays explicit,
 * the check stays a prompt, and the decision is on the record.
 */
export function NearMatchDialog({ pending, onClose }: { pending: PendingNearMatch | null; onClose: (confirmed: boolean) => void }) {
  const t = useT();
  return (
    <Dialog
      open={pending !== null}
      onClose={() => onClose(false)}
      title={t('sharing.nearMatch.title')}
      actions={
        <>
          <Button variant="quiet" onClick={() => onClose(false)}>
            {t('sharing.nearMatch.decline')}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              pending?.onConfirm();
              onClose(true);
            }}
          >
            {t('sharing.nearMatch.confirm')}
          </Button>
        </>
      }
    >
      {pending ? (
        <div className={styles.body}>
          <p>{t('sharing.nearMatch.text')}</p>
          <p className={styles.typed}>{t('sharing.nearMatch.typed', { name: pending.name })}</p>
          {pending.matches.map((match) => (
            <div key={`${match.entryName}-${match.party.party}`} className={styles.entry}>
              <p>
                {t('sharing.nearMatch.entry', {
                  entry: match.entryName,
                  date: match.party.since ? formatDate(match.party.since) : t('common.values.notRecorded'),
                  party: exclusionPartyLabel(match.party.party).toLowerCase(),
                  reason: match.party.reason ?? match.exclusion.reason,
                })}
              </p>
              <p className={styles.kind}>{t('sharing.nearMatch.kind', { kind: KIND_KEYS[match.similarity.kind] })}</p>
            </div>
          ))}
        </div>
      ) : null}
    </Dialog>
  );
}
