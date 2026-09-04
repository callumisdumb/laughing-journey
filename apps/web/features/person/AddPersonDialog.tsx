'use client';

import { LIFE_STAGES, canCreate, findDuplicateCandidates, lifeStageLabel, syntheticChi, type DuplicateCandidate, type Person } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, Dialog, Pill, RadioGroup, SelectField, TextField, TextareaField, DateField, useToast } from '@mas/ui';
import { Search, ShieldAlert, UserSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { PersonLink } from '@/components/EntityLink';
import { reasonKey, reasonLabel } from './reasons';
import { accessForUser, fullName, processesInvolving } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import { useRetire } from '@/lib/retire';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './AddPersonDialog.module.css';

type Step = 'search' | 'candidates' | 'details';

interface Query {
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  chi: string;
  address: string;
}

interface Details {
  lifeStage: Person['lifeStage'];
  precision: NonNullable<Person['dateOfBirthPrecision']>;
  expectedDeliveryDate: string;
  sex: Person['sex'];
  chi: string;
  addressId: string;
  noFixedAddress: boolean;
  aliases: string;
  interpreter: string;
}

const EMPTY_QUERY: Query = { givenName: '', familyName: '', dateOfBirth: '', chi: '', address: '' };
const EMPTY_DETAILS: Details = { lifeStage: 'child', precision: 'exact', expectedDeliveryDate: '', sex: 'not-recorded', chi: '', addressId: '', noFixedAddress: false, aliases: '', interpreter: '' };

/**
 * Adding a person, which begins with looking for them.
 *
 * There is no direct create. The single most damaging thing this product could do is hold two
 * records for one child, and that is not hypothetical: it is a named finding in review after review,
 * and a multi-agency system multiplies the harm, because the two records end up with different
 * agencies who each believe they have the whole picture.
 *
 * So the create button opens a search, the candidates come back with the reason each one matched,
 * and the form only appears once the practitioner has said in as many words that none of them is the
 * person. That assertion is recorded on the new record, because "created after reviewing three
 * candidates" is something an inspector can ask about and "the search was shown" is not.
 *
 * The case that matters most is the candidate the searcher cannot see. A duplicate usually gets
 * created precisely because the existing record was invisible, so a presence-only match says the
 * person may already be known and points at the access request rather than the create button.
 */
export function AddPersonDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (person: Person) => void }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const grants = useGrants();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const retire = useRetire((s) => s.retire);
  const { toast } = useToast();

  const [query, setQuery] = useState<Query>(EMPTY_QUERY);
  const [step, setStep] = useState<Step>('search');
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [errors, setErrors] = useState<string[]>([]);

  const decision = user ? canCreate(user.roleId, 'person') : ({ allowed: false, reason: t('person.create.gated.noUser'), route: t('person.create.gated.signIn') } as const);
  const searched = step !== 'search';

  const candidates = useMemo(() => (searched ? findDuplicateCandidates(data.people, data.addresses, query) : []), [searched, data.people, data.addresses, query]);

  /*
   * Whether the searcher can actually see each candidate, which is what decides the advice given.
   *
   * A person on no process at all is visible to everybody; a person whose only processes are
   * presence-only to this reader is the dangerous case, because the searcher is looking at a name
   * they cannot open and the obvious next move is to create a second record for the same child.
   */
  const visible = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!user) return map;
    for (const candidate of candidates) {
      const processes = processesInvolving(data, candidate.person.id);
      map.set(
        candidate.person.id,
        processes.length === 0 ||
          processes.some((p) => {
            const level = accessForUser(data, config, user, p, grants, now).level;
            return level !== 'presence' && level !== 'none';
          }),
      );
    }
    return map;
  }, [candidates, data, config, user, grants, now]);

  const addressOptions = useMemo(
    () =>
      [...data.addresses]
        .map((a) => ({ value: a.id, label: [a.line1, a.line2, a.town, a.postcode].filter(Boolean).join(', ') }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [data.addresses],
  );

  /** Any edit to the search sends the flow back to the start, so the assertion cannot go stale. */
  function edit(next: Partial<Query>) {
    setQuery((q) => ({ ...q, ...next }));
    setStep('search');
    setErrors([]);
  }

  function close() {
    setQuery(EMPTY_QUERY);
    setDetails(EMPTY_DETAILS);
    setStep('search');
    setErrors([]);
    onClose();
  }

  function generateChi() {
    const dob = details.lifeStage === 'unborn' ? '' : query.dateOfBirth;
    if (!dob) {
      setErrors(['chiNeedsDateOfBirth']);
      return;
    }
    setDetails((d) => ({ ...d, chi: syntheticChi(dob, d.sex, data.people.length + 1) }));
    setErrors([]);
  }

  function create() {
    if (!user) return;
    const unborn = details.lifeStage === 'unborn';
    const dateOfBirth = unborn || query.dateOfBirth.trim() === '' ? undefined : query.dateOfBirth;
    const rules: string[] = [];
    if (query.givenName.trim() === '' || query.familyName.trim() === '') rules.push('nameRequired');
    if (dateOfBirth && dateOfBirth > now.toISOString().slice(0, 10)) rules.push('dateOfBirthFuture');
    if (unborn && details.expectedDeliveryDate && details.expectedDeliveryDate < now.toISOString().slice(0, 10)) rules.push('expectedDeliveryPast');

    const person: Person = {
      id: newId('per'),
      synthetic: true,
      givenName: query.givenName.trim(),
      familyName: query.familyName.trim(),
      aliases: details.aliases
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean),
      lifeStage: details.lifeStage,
      dateOfBirth,
      dateOfBirthPrecision: dateOfBirth ? details.precision : undefined,
      expectedDeliveryDate: unborn && details.expectedDeliveryDate ? details.expectedDeliveryDate : undefined,
      sex: details.sex,
      chi: details.chi.trim() || undefined,
      addressHistory: details.addressId && !details.noFixedAddress ? [{ addressId: details.addressId, from: now.toISOString().slice(0, 10) }] : [],
      communicationNeeds: { needs: [], interpreterLanguage: details.interpreter.trim() || undefined },
      alerts: [],
      contact: {},
      createdAt: now.toISOString(),
      createdAfterReviewing: candidates.length,
    };
    const name = `${person.givenName} ${person.familyName}`.trim();

    const result = write({
      collection: 'people',
      record: person,
      intent: 'create',
      act: 'create',
      targetType: 'person',
      targetLabel: name,
      reason: t('person.create.reviewed', { count: candidates.length }),
      rules,
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    // The one honest shortcut on a create: for the few seconds the toast is up, the record that was
    // just made can be sent to the correction path. Not an undo, which would delete it. The dialog
    // it opens still asks for the reason, because the reason is what makes it a correction.
    toast({
      title: t('person.create.created.title'),
      text: t('person.create.created.text', { name, reviewed: t('person.create.reviewed', { count: candidates.length }) }),
      tone: 'success',
      action: { label: t('common.recordedInError.undo'), onClick: () => retire({ collection: 'people', id: person.id, label: name }) },
    });
    onCreated?.(person);
    close();
  }

  if (!decision.allowed) {
    return (
      <Dialog
        open={open}
        onClose={close}
        title={t('person.create.gated.title')}
        size="sm"
        actions={
          <Button variant="primary" onClick={close}>
            {t('common.actions.close')}
          </Button>
        }
      >
        <div className={styles.gate} data-testid="create-person-gate">
          <p className={styles.gateReason}>{decision.reason}</p>
          <p className={styles.gateRoute}>{decision.route}</p>
        </div>
      </Dialog>
    );
  }

  const canSearch = query.givenName.trim() !== '' || query.familyName.trim() !== '' || query.chi.trim() !== '';
  const unborn = details.lifeStage === 'unborn';

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('person.create.title')}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={close}>
            {t('common.actions.cancel')}
          </Button>
          {step === 'search' ? (
            <Button variant="primary" icon={<Search size={16} aria-hidden="true" />} disabled={!canSearch} onClick={() => setStep('candidates')} data-testid="create-person-search">
              {t('person.create.search')}
            </Button>
          ) : null}
          {step === 'candidates' ? (
            <Button variant="secondary" onClick={() => setStep('details')} data-testid="create-person-none-match">
              {t('person.create.noneMatch')}
            </Button>
          ) : null}
          {step === 'details' ? (
            <Button variant="primary" onClick={create} data-testid="create-person-submit">
              {t('person.create.submit')}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="stack" data-step={step}>
        <p className={styles.warning}>
          <ShieldAlert size={16} aria-hidden="true" />
          {t('person.create.syntheticWarning')}
        </p>

        <section aria-labelledby="add-person-search">
          <h3 className={styles.stepTitle} id="add-person-search">
            {t('person.create.searchStep')}
          </h3>
          <p className={styles.lede}>{t('person.create.searchLede')}</p>
          <div className={styles.grid}>
            <TextField label={t('person.create.fields.givenName')} value={query.givenName} onChange={(e) => edit({ givenName: e.target.value })} autoComplete="off" />
            <TextField label={t('person.create.fields.familyName')} value={query.familyName} onChange={(e) => edit({ familyName: e.target.value })} autoComplete="off" />
            <DateField label={t('person.create.fields.dateOfBirth')} value={query.dateOfBirth} onChange={(v) => edit({ dateOfBirth: v })} hint={t('person.create.fields.dateOfBirthHint')} />
            <TextField label={t('person.create.fields.chi')} value={query.chi} onChange={(e) => edit({ chi: e.target.value })} inputMode="numeric" autoComplete="off" hint={t('person.create.fields.chiHint')} />
            <TextField label={t('person.create.fields.address')} value={query.address} onChange={(e) => edit({ address: e.target.value })} autoComplete="off" hint={t('person.create.fields.addressHint')} />
          </div>
        </section>

        {searched ? (
          <section aria-labelledby="add-person-candidates" data-testid="create-person-candidates">
            <h3 className={styles.stepTitle} id="add-person-candidates">
              {t('person.create.candidates.title', { count: candidates.length })}
            </h3>
            <p className={styles.lede}>{candidates.length === 0 ? t('person.create.candidates.none') : t('person.create.candidates.hint')}</p>
            {candidates.length > 0 ? (
              <ul className={styles.candidates}>
                {candidates.map((candidate) => (
                  <Candidate key={candidate.person.id} candidate={candidate} visible={visible.get(candidate.person.id) ?? true} />
                ))}
              </ul>
            ) : null}
            {step === 'candidates' ? (
              <p className={styles.assert}>
                <UserSearch size={16} aria-hidden="true" />
                {candidates.length === 0 ? t('person.create.noneFoundHint') : t('person.create.noneMatchHint')}
              </p>
            ) : null}
          </section>
        ) : null}

        {step === 'details' ? (
          <section aria-labelledby="add-person-details" data-testid="create-person-details">
            <h3 className={styles.stepTitle} id="add-person-details">
              {t('person.create.detailsStep')}
            </h3>
            <p className={styles.lede}>{t('person.create.reviewed', { count: candidates.length })}</p>
            <div className={styles.grid}>
              <SelectField label={t('person.create.lifeStage')} value={details.lifeStage} onChange={(e) => setDetails({ ...details, lifeStage: e.target.value as Person['lifeStage'] })} options={LIFE_STAGES.map((s) => ({ value: s, label: lifeStageLabel(s) }))} />
              <SelectField
                label={t('person.create.sex')}
                value={details.sex}
                onChange={(e) => setDetails({ ...details, sex: e.target.value as Person['sex'] })}
                options={[
                  { value: 'female', label: t('person.create.sexOptions.female') },
                  { value: 'male', label: t('person.create.sexOptions.male') },
                  { value: 'not-recorded', label: t('person.create.sexOptions.notRecorded') },
                ]}
              />
              {unborn ? <DateField label={t('person.create.expectedDeliveryDate')} value={details.expectedDeliveryDate} onChange={(v) => setDetails({ ...details, expectedDeliveryDate: v })} hint={t('person.create.unbornHint')} /> : null}
            </div>
            {!unborn && query.dateOfBirth ? (
              <RadioGroup
                legend={t('person.create.precision.label')}
                name="dob-precision"
                value={details.precision}
                onChange={(v) => setDetails({ ...details, precision: v as Details['precision'] })}
                orientation="horizontal"
                hint={t('person.create.precision.hint')}
                options={[
                  { value: 'exact', label: t('person.create.precision.exact') },
                  { value: 'year', label: t('person.create.precision.year') },
                  { value: 'estimated', label: t('person.create.precision.estimated') },
                ]}
              />
            ) : null}
            <div className={styles.chiRow}>
              <TextField label={t('person.create.chi')} value={details.chi} onChange={(e) => setDetails({ ...details, chi: e.target.value })} inputMode="numeric" hint={t('person.create.chiHint')} />
              <Button variant="secondary" onClick={generateChi} data-testid="create-person-generate-chi">
                {t('person.create.generateChi')}
              </Button>
            </div>
            <div className={styles.grid}>
              <SelectField label={t('person.create.address')} value={details.addressId} disabled={details.noFixedAddress} onChange={(e) => setDetails({ ...details, addressId: e.target.value })} placeholder={t('person.create.addressNotKnown')} options={addressOptions} hint={t('person.create.addressHint')} />
              <CheckboxField label={t('person.create.noFixedAddress')} checked={details.noFixedAddress} onChange={(e) => setDetails({ ...details, noFixedAddress: e.target.checked, addressId: e.target.checked ? '' : details.addressId })} hint={t('person.create.noFixedAddressHint')} />
              <TextField label={t('person.create.interpreter')} value={details.interpreter} onChange={(e) => setDetails({ ...details, interpreter: e.target.value })} hint={t('person.create.interpreterHint')} />
            </div>
            <TextareaField label={t('person.create.aliases')} value={details.aliases} onChange={(e) => setDetails({ ...details, aliases: e.target.value })} hint={t('person.create.aliasesHint')} rows={3} />
          </section>
        ) : null}
      </div>
    </Dialog>
  );
}

function Candidate({ candidate, visible }: { candidate: DuplicateCandidate; visible: boolean }) {
  const t = useT();
  const { person, reasons } = candidate;
  return (
    <li className={styles.candidate} data-visible={visible ? 'true' : 'false'}>
      <span className={styles.candidateName}>{visible ? <PersonLink person={person}>{fullName(person)}</PersonLink> : fullName(person)}</span>
      <span className={styles.candidateMeta}>{person.dateOfBirth ?? person.expectedDeliveryDate ?? t('person.create.candidates.noDateOfBirth')}</span>
      <ul className={styles.reasons}>
        {reasons.map((reason) => (
          <li key={reasonKey(reason)}>
            <Pill size="sm" tone={reason.kind === 'chi' ? 'critical' : 'outline'}>
              {reasonLabel(reason)}
            </Pill>
          </li>
        ))}
      </ul>
      {!visible ? (
        <p className={styles.presence}>
          {t('person.create.candidates.presenceOnly')} <AppLink href="/sharing">{t('person.create.candidates.requestAccess')}</AppLink>
        </p>
      ) : null}
    </li>
  );
}
