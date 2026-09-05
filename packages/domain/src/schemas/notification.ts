import { t, tKey } from '@mas/messages';
import { z } from 'zod';
import { AGENCIES, DETAIL_LEVELS, ROLES, keySegment } from '../enums';
import { idSchema, isoDateTime, syntheticSchema } from './common';

/**
 * A notification: the product telling one person, or everybody holding one role in one agency,
 * that something happened which concerns them.
 *
 * It stores no case content. The summary a person reads is computed from `kind` and the source
 * record at render time, from the catalogue, so a notification never carries a name or a fact that
 * the recipient's access level would withhold, and its wording is editable in Copy and labels like
 * everything else. What it does carry is the detail level the recipient is entitled to, so a
 * presence-level recipient is told that a case they are linked to changed and nothing more, and the
 * lawful basis where the thing being announced reveals content.
 *
 * Written by the write pipeline and the clock engine, never by a component (D-207).
 */
export const NOTIFICATION_KINDS = [
  'share',
  'request',
  'request-returned',
  'action-assigned',
  'action-reassigned',
  'action-due',
  'action-overdue',
  'action-completed',
  'meeting-invited',
  'meeting-changed',
  'meeting-cancelled',
  'minute-distributed',
  'stage-changed',
  'membership-added',
  'membership-removed',
  'inbox-arrived',
  'break-glass',
  'classification-raised',
  'exclusion-near-match',
  'involvement-requested',
  'involvement-decided',
  'clock-warning',
  'clock-breached',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function notificationKindLabel(kind: NotificationKind): string {
  return tKey(`domain.notificationKinds.${keySegment(kind)}`);
}

/** What the notification points at, which decides where opening it goes. */
export const NOTIFICATION_SOURCES = ['process', 'action', 'meeting', 'sharing', 'request', 'clock', 'inbox', 'audit', 'involvement'] as const;
export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];

/** A role-addressed recipient: everybody holding the role in the agency, or anybody in the agency. */
export const notificationRoleSchema = z.object({
  agency: z.enum(AGENCIES),
  roleId: z.union([z.enum(ROLES), z.literal('any')]),
});
export type NotificationRole = z.infer<typeof notificationRoleSchema>;

export const notificationSchema = z
  .object({
    id: idSchema,
    synthetic: syntheticSchema,
    toUserId: idSchema.optional(),
    toRole: notificationRoleSchema.optional(),
    kind: z.enum(NOTIFICATION_KINDS),
    sourceType: z.enum(NOTIFICATION_SOURCES),
    sourceId: z.string(),
    processId: idSchema.optional(),
    subjectId: idSchema.optional(),
    /** The level the recipient holds on the case, which bounds what the rendered text may say. */
    detailLevel: z.enum(DETAIL_LEVELS),
    /** Required by the pipeline for anything that reveals content; a presence notification has none. */
    lawfulBasisId: idSchema.optional(),
    createdAt: isoDateTime,
    readAt: isoDateTime.optional(),
    dismissedAt: isoDateTime.optional(),
    createdByUserId: idSchema.optional(),
    /**
     * What makes this notification the same as another. The pipeline refuses to write a second
     * notification with a key it already holds, so a clock re-evaluated on every render raises one
     * warning rather than one per render, and a stage change announced to a member is announced once.
     */
    key: z.string().min(1),
  })
  .refine((n) => (n.toUserId ? 1 : 0) + (n.toRole ? 1 : 0) === 1, { error: () => t('errors.schemas.notificationRecipient') });
export type Notification = z.infer<typeof notificationSchema>;
