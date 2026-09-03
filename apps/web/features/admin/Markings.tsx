'use client';

import {
  CLASSIFICATION_LEVELS,
  CLASSIFICATION_RULES,
  HANDLING_INSTRUCTIONS,
  MARKING_PROFILES,
  ROLES,
  classificationDefinition,
  classificationLabel,
  classificationLevelLabel,
  classificationReasonLabel,
  handlingInstructionLabel,
  marking,
  officialSensitive,
  officialSensitiveDefinition,
  profileClassification,
  roleLabel,
  type HandlingInstructionId,
  type MarkingProfileId,
  type RoleId,
} from '@mas/domain';
import { tKey, useT, type Translator } from '@mas/messages';
import { Button, CheckboxField, Sheet, SheetBody, SheetHead, Table, TableWrap, TextareaField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Fragment, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import styles from './Markings.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';
import { useAdminConfig } from './useAdminConfig';

const MARKING_KEYS: Record<MarkingProfileId, string> = { official: 'official', 'official-sensitive': 'officialSensitive', 'access-restricted': 'accessRestricted' };
const markingTitle = (id: MarkingProfileId) => tKey(`admin.markings.${MARKING_KEYS[id]}.title`);
const markingUse = (id: MarkingProfileId) => tKey(`admin.markings.${MARKING_KEYS[id]}.use`);

/** Roles are listed alphabetically by name: the list is long, and a reader is looking one up, not browsing. */
const SORTED_ROLES = [...ROLES].sort((a, b) => roleLabel(a).localeCompare(roleLabel(b), 'en-GB'));

function markingsSchema(t: Translator) {
  return z.object({
    markings: z.array(
      z.object({
        id: z.enum(MARKING_PROFILES),
        handling: z.string().trim().min(5, t('admin.markings.errors.handlingMin')).max(400),
        instructions: z.array(z.enum(HANDLING_INSTRUCTIONS)),
      }),
    ),
    lowerableBy: z.array(z.enum(ROLES)),
  });
}
type MarkingsValues = z.infer<ReturnType<typeof markingsSchema>>;

export function Markings() {
  const t = useT();
  const { config, canEdit, save } = useAdminConfig();
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const schema = useMemo(() => markingsSchema(t), [t]);
  const form = useForm<MarkingsValues>({
    resolver: zodResolver(schema),
    defaultValues: { markings: config.classificationMarkings, lowerableBy: config.classificationLowerableBy },
  });
  const lowerableBy = form.watch('lowerableBy');
  const markings = form.watch('markings');
  const errors = form.formState.errors;

  function submit(values: MarkingsValues) {
    const result = save(
      { ...config, classificationMarkings: values.markings, classificationLowerableBy: values.lowerableBy },
      'markings',
      t('admin.markings.audit', { roles: values.lowerableBy.length }),
    );
    setSaveErrors(result.errors);
    if (result.ok) form.reset(values);
  }

  function toggleRole(role: RoleId, on: boolean) {
    const next = on ? [...lowerableBy, role] : lowerableBy.filter((r) => r !== role);
    form.setValue('lowerableBy', ROLES.filter((r) => next.includes(r)), { shouldDirty: true });
  }

  function toggleInstruction(index: number, id: HandlingInstructionId, on: boolean) {
    const current = markings[index]?.instructions ?? [];
    const next = on ? [...current, id] : current.filter((i) => i !== id);
    form.setValue(`markings.${index}.instructions`, HANDLING_INSTRUCTIONS.filter((i) => next.includes(i)), { shouldDirty: true });
  }

  return (
    <>
      <SectionHead
        title={sectionLabel('markings')}
        lede={t('admin.markings.lede')}
        actions={
          <>
            <Button
              variant="quiet"
              disabled={!form.formState.isDirty}
              onClick={() => form.reset({ markings: config.classificationMarkings, lowerableBy: config.classificationLowerableBy })}
            >
              {t('admin.actions.discardChanges')}
            </Button>
            <Button variant="primary" disabled={!canEdit || !form.formState.isDirty} onClick={() => void form.handleSubmit(submit)()}>
              {t('admin.markings.save')}
            </Button>
          </>
        }
      />
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <Sheet>
          <SheetHead title={t('admin.markings.rules.title')} meta={t('admin.markings.rules.meta')} headingLevel={2} />
          <SheetBody>
            <p className={styles.note}>{t('admin.markings.rules.readOnly')}</p>
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('admin.markings.rules.columnRule')}</th>
                    <th scope="col">{t('admin.markings.rules.columnLevel')}</th>
                    <th scope="col">{t('admin.markings.rules.columnMarking')}</th>
                  </tr>
                </thead>
                <tbody>
                  {CLASSIFICATION_RULES.map((rule) => {
                    const derived = { level: rule.level, sensitive: rule.sensitive, handling: [] };
                    const text = marking(derived);
                    return (
                      <tr key={rule.reason}>
                        <th scope="row">{classificationReasonLabel(rule.reason)}</th>
                        <td>{classificationLabel(derived)}</td>
                        <td>{text ?? t('admin.markings.rules.noMarking')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
            <dl className={styles.definitions}>
              {CLASSIFICATION_LEVELS.map((level) => (
                <Fragment key={level}>
                  <dt>{classificationLevelLabel(level)}</dt>
                  <dd>{classificationDefinition(level)}</dd>
                </Fragment>
              ))}
              <dt>{classificationLabel(officialSensitive())}</dt>
              <dd>{officialSensitiveDefinition()}</dd>
            </dl>
          </SheetBody>
        </Sheet>

        <p className={styles.note}>{t('admin.markings.profileNote')}</p>

        {config.classificationMarkings.map((m, i) => {
          const instructions = markings[i]?.instructions ?? [];
          const text = marking(profileClassification(m.id, instructions.map(handlingInstructionLabel)));
          return (
            <Sheet key={m.id}>
              <SheetHead title={markingTitle(m.id)} meta={markingUse(m.id)} headingLevel={2} />
              <SheetBody>
                {text ? (
                  <div className={styles.banner} role="note" aria-label={t('admin.markings.bannerPreview', { label: text })}>
                    {text}
                  </div>
                ) : (
                  <p className={styles.note}>{t('admin.markings.rules.noMarking')}</p>
                )}
                <div className={styles.fields}>
                  <TextareaField
                    label={t('admin.markings.handlingField')}
                    hint={t('admin.markings.handlingHint')}
                    required
                    disabled={!canEdit}
                    maxLength={400}
                    {...form.register(`markings.${i}.handling`)}
                    error={errors.markings?.[i]?.handling?.message}
                  />
                  <fieldset className={styles.instructions} disabled={m.id === 'official'}>
                    <legend className={styles.legend}>{t('admin.markings.instructions.legend')}</legend>
                    <p className={styles.note}>{m.id === 'official' ? t('admin.markings.instructions.officialNote') : t('admin.markings.instructions.note')}</p>
                    {HANDLING_INSTRUCTIONS.map((id) => (
                      <CheckboxField
                        key={id}
                        label={handlingInstructionLabel(id)}
                        checked={instructions.includes(id)}
                        disabled={!canEdit || m.id === 'official' || (m.id === 'access-restricted' && id === 'distribution-list-only')}
                        onChange={(e) => toggleInstruction(i, id, e.target.checked)}
                      />
                    ))}
                  </fieldset>
                </div>
              </SheetBody>
            </Sheet>
          );
        })}

        <Sheet>
          <SheetHead title={t('admin.markings.lower.title')} meta={t('admin.markings.lower.meta')} headingLevel={2} />
          <SheetBody>
            <p className={styles.note}>{t('admin.markings.lower.note')}</p>
            <fieldset className={styles.roles}>
              <legend className={styles.legend}>{t('admin.markings.lower.legend')}</legend>
              {SORTED_ROLES.map((role) => (
                <CheckboxField key={role} label={roleLabel(role)} checked={lowerableBy.includes(role)} disabled={!canEdit} onChange={(e) => toggleRole(role, e.target.checked)} />
              ))}
            </fieldset>
            <p className={styles.note}>{t('admin.markings.lower.count', { count: lowerableBy.length })}</p>
          </SheetBody>
        </Sheet>

        {saveErrors.length > 0 ? (
          <ul className={styles.errors} role="alert">
            {saveErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </>
  );
}
