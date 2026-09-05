/**
 * What a share carries, and what a recipient is shown.
 *
 * Every share records the classification of what was shared at the moment it was shared. That is a
 * deliberate copy rather than a lookup: the source record can be raised afterwards, and the record of
 * the decision has to say what went out under what marking, because that is what the recipient acted
 * on and what an inspector will ask about.
 *
 * The second half is the rule that needs the field to exist at all. A recipient whose role may not
 * receive Official-Sensitive content sees the marking and the reason they are on the list, and not
 * the content. Marking and reason rather than nothing at all: a recipient who can see that something
 * exists and why they were told can ask for it through the proper route, where one who sees an empty
 * screen simply telephones the social worker.
 */
import type { AccessRestriction, RoleId } from '../enums';
import type { Config } from '../schemas/config';
import { classificationRank, isMarked, type Classification } from './classify';

/** A share, a request or anything else that carries a captured classification. */
export interface ClassifiedShare {
  classification: Classification;
  accessRestriction: AccessRestriction;
}

/** Why a recipient is not being shown the content. */
export type WithholdReason = 'role-may-not-receive-sensitive';

export interface RecipientView {
  /** Whether the content itself may be shown. */
  showContent: boolean;
  /** Present when the content is withheld, so the screen can say which rule applied. */
  withheld?: WithholdReason;
}

/**
 * What a recipient may see of a share. The marking and the reason are always shown; the content is
 * withheld where the recipient's role may not receive Official-Sensitive material.
 */
export function recipientView(config: Config, share: ClassifiedShare, roleId: RoleId): RecipientView {
  if (!isMarked(share.classification)) return { showContent: true };
  if (config.officialSensitiveWithheldFrom.includes(roleId)) return { showContent: false, withheld: 'role-may-not-receive-sensitive' };
  return { showContent: true };
}

/**
 * Whether a share's captured classification is at least as strong as its source's.
 *
 * A share that went out marked lower than the record it came from is a quiet downgrade, which is the
 * failure this whole field exists to make visible. The invariant is asserted by a test over the whole
 * seed rather than checked at render time, because by render time the share has already been sent.
 */
export function shareIsNoWeakerThanSource(share: ClassifiedShare, source: ClassifiedShare): boolean {
  if (classificationRank(share.classification) < classificationRank(source.classification)) return false;
  return !(source.accessRestriction === 'restricted' && share.accessRestriction !== 'restricted');
}

/** The classification a share should carry, taken from the record it is about. */
export function classificationOfShare(source: ClassifiedShare): ClassifiedShare {
  return { classification: { ...source.classification, handling: [...source.classification.handling] }, accessRestriction: source.accessRestriction };
}
