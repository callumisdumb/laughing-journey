'use client';

import { processLabel, type Person, type Process } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Button, Dialog, SelectField, useToast } from '@mas/ui';
import { AlarmClock, CalendarDays, FileText, FolderPlus, ListChecks, Send, ShieldAlert, ShieldCheck, Stethoscope, UserPlus, UserX, Users } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { PersonPicker } from '@/components/PersonPicker';
import { useNavigate } from '@/lib/router';
import { personPath } from '@/lib/routes';
import { accessForUser, fullName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import { AddAlertDialog } from '@/features/person/AddAlertDialog';
import { AddPersonDialog } from '@/features/person/AddPersonDialog';
import { StartProcessDialog } from '@/features/person/StartProcessDialog';
import { AddEventDialog } from '@/features/chronology/AddEventDialog';
import { AddPlanDialog } from '@/features/process/AddPlanDialog';
import { InvestigationDialog, SupervisionVisitDialog } from '@/features/process/forms/AwiRecordDialogs';
import { DisclosureDecisionDialog } from '@/features/process/forms/DisclosureDecisionDialog';
import { ProtectionOrderDialog } from '@/features/process/forms/ProtectionOrderDialog';
import { RegisterEntryDialog } from '@/features/process/forms/RegisterEntryDialog';
import styles from './CreateMenu.module.css';

type Kind =
  | 'person'
  | 'process'
  | 'event'
  | 'alert'
  | 'views'
  | 'plan'
  | 'register'
  | 'order'
  | 'disclosure'
  | 'visit'
  | 'investigation'
  | 'meeting'
  | 'action'
  | 'share';

interface Option {
  kind: Kind;
  icon: ReactNode;
  /** What the create needs before it can start: nothing, a person, or a case of a given type. */
  needs: 'nothing' | 'person' | 'process';
  /** Where a process-scoped create is offered, restricted to the case types that hold the record. */
  processTypes?: Process['type'][];
  /** A create that lives on a screen rather than in a dialog goes there instead. */
  go?: string;
}

const ABOUT_A_PERSON: Option[] = [
  { kind: 'person', icon: <UserPlus size={16} aria-hidden="true" />, needs: 'nothing' },
  { kind: 'process', icon: <FolderPlus size={16} aria-hidden="true" />, needs: 'person' },
  { kind: 'event', icon: <FileText size={16} aria-hidden="true" />, needs: 'person' },
  { kind: 'alert', icon: <ShieldAlert size={16} aria-hidden="true" />, needs: 'person' },
  { kind: 'views', icon: <Users size={16} aria-hidden="true" />, needs: 'person', go: '?tab=voice' },
];

const ON_A_CASE: Option[] = [
  { kind: 'plan', icon: <ListChecks size={16} aria-hidden="true" />, needs: 'process' },
  { kind: 'register', icon: <UserX size={16} aria-hidden="true" />, needs: 'process' },
  { kind: 'order', icon: <ShieldCheck size={16} aria-hidden="true" />, needs: 'process', processTypes: ['asp'] },
  { kind: 'disclosure', icon: <Send size={16} aria-hidden="true" />, needs: 'process', processTypes: ['mappa'] },
  { kind: 'visit', icon: <Stethoscope size={16} aria-hidden="true" />, needs: 'process', processTypes: ['awi'] },
  { kind: 'investigation', icon: <AlarmClock size={16} aria-hidden="true" />, needs: 'process', processTypes: ['awi'] },
];

const ELSEWHERE: Option[] = [
  { kind: 'meeting', icon: <CalendarDays size={16} aria-hidden="true" />, needs: 'nothing', go: '/meetings' },
  { kind: 'action', icon: <ListChecks size={16} aria-hidden="true" />, needs: 'nothing', go: '/actions' },
  { kind: 'share', icon: <Send size={16} aria-hidden="true" />, needs: 'nothing', go: '/sharing' },
];

/**
 * The global create action, which is the only place in the product that answers "what can I make?".
 *
 * Everything creatable is reachable from the screen it belongs to, and that is the right primary
 * route: you record a plan while looking at the case. But a practitioner who has just come off the
 * phone is not on any particular screen, and a product where the answer to "where do I put this" is
 * "find the right screen first" loses the record. So the menu asks what, then asks the one thing the
 * create needs (a person, or a case), then opens the same dialog the screen would have opened. It is
 * the same code path, not a second one, which is why there is no risk of the two drifting.
 *
 * Three creates are not dialogs at all: a meeting, an action and a share are made on their own
 * screens with context those screens hold. The menu says so and takes you there rather than
 * pretending to a completeness it does not have.
 */
export function CreateMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const navigate = useNavigate();
  const grants = useAppStore((s) => s.session.breakGlass);
  const { toast } = useToast();

  const [kind, setKind] = useState<Kind | null>(null);
  const [person, setPerson] = useState<Person | null>(null);
  const [processId, setProcessId] = useState('');
  const [running, setRunning] = useState<Kind | null>(null);

  const option = [...ABOUT_A_PERSON, ...ON_A_CASE, ...ELSEWHERE].find((o) => o.kind === kind);
  // Only cases this persona can actually read. Offering one that opens onto a restricted state is
  // not a create path, it is a dead end with a case reference on it.
  const readable = user
    ? data.processes.filter((p) => p.status === 'open' && accessForUser(data, config, user, p, grants, now).level !== 'none')
    : [];
  const choices = option?.processTypes ? readable.filter((p) => option.processTypes!.includes(p.type)) : readable;
  const chosen = choices.find((p) => p.id === processId);

  /*
   * The menu starts fresh each time it is opened rather than each time it is closed.
   *
   * Closing is the wrong moment: the Dialog primitive fires `onClose` for every way a dialog can
   * shut, including the programmatic close that hands a create over to its own dialog, and clearing
   * the chosen person there took the person away from the dialog that had just been given it. So
   * the state is cleared on the way in, where nothing downstream is still holding it.
   */
  useEffect(() => {
    if (open) reset();
  }, [open]);

  function reset() {
    setKind(null);
    setPerson(null);
    setProcessId('');
  }

  function pick(o: Option) {
    if (o.needs === 'nothing' && o.go) {
      navigate(o.go);
      close();
      return;
    }
    if (o.needs === 'nothing') {
      setRunning(o.kind);
      onClose();
      return;
    }
    setKind(o.kind);
    setProcessId('');
    setPerson(null);
  }

  function go() {
    if (!option) return;
    if (option.kind === 'views' && person) {
      navigate(`${personPath(person.id)}${option.go ?? ''}`);
      close();
      return;
    }
    if (option.needs === 'person' && !person) return;
    if (option.needs === 'process' && !chosen) return;
    setRunning(option.kind);
    onClose();
  }

  function close() {
    onClose();
  }

  /**
   * Where a chosen case is not the one the create needs, say so rather than disabling silently.
   * The register entry is the only case-scoped create that works on every process type.
   */
  const noCases = option?.needs === 'process' && choices.length === 0;

  return (
    <>
      <Dialog
        open={open}
        onClose={close}
        title={t('nav.create.title')}
        size={kind ? 'md' : 'lg'}
        actions={
          kind ? (
            <>
              <Button variant="quiet" onClick={reset}>
                {t('nav.create.back')}
              </Button>
              <Button variant="primary" onClick={go} data-testid="create-continue">
                {t('nav.create.continue')}
              </Button>
            </>
          ) : (
            <Button variant="quiet" onClick={close}>
              {t('common.actions.cancel')}
            </Button>
          )
        }
      >
        {kind && option ? (
          <div>
            <div className={styles.chosen}>
              <span className={styles.chosenLabel}>{tKey(`nav.create.labels.${option.kind}`)}</span>
              <span>{tKey(`nav.create.hints.${option.kind}`)}</span>
            </div>
            {option.needs === 'person' ? (
              <PersonPicker label={t('nav.create.whichPerson')} value={person} onChange={setPerson} idPrefix="create-person" hint={t('nav.create.whichPersonHint')} />
            ) : null}
            {option.needs === 'process' ? (
              noCases ? (
                <p className={styles.empty} data-testid="create-no-cases">
                  {t('nav.create.noCases')}
                </p>
              ) : (
                <SelectField
                  label={t('nav.create.whichCase')}
                  hint={t('nav.create.whichCaseHint')}
                  value={processId}
                  onChange={(e) => setProcessId(e.target.value)}
                  placeholder={t('nav.create.casePlaceholder')}
                  options={choices.map((p) => ({ value: p.id, label: t('nav.create.caseOption', { reference: p.reference, type: processLabel(p.type), title: p.title }) }))}
                  data-testid="create-case"
                />
              )
            ) : null}
          </div>
        ) : (
          <div className={styles.groups}>
            {([
              ['aboutAPerson', ABOUT_A_PERSON],
              ['onACase', ON_A_CASE],
              ['elsewhere', ELSEWHERE],
            ] as const).map(([group, options]) => (
              <section key={group}>
                <h3 className={styles.groupTitle}>{tKey(`nav.create.groups.${group}`)}</h3>
                <div className={styles.options}>
                  {options.map((o) => (
                    <button key={o.kind} type="button" className={styles.option} onClick={() => pick(o)} data-testid={`create-${o.kind}`}>
                      <span className={styles.optionIcon}>{o.icon}</span>
                      <span className={styles.optionText}>
                        <span className={styles.optionLabel}>{tKey(`nav.create.labels.${o.kind}`)}</span>
                        <span className={styles.optionHint}>{tKey(`nav.create.hints.${o.kind}`)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Dialog>

      {/*
        The same dialogs the screens mount, with the same props. A create started here and a create
        started from the record are one code path, so a rule added to one is added to both.
      */}
      {running === 'person' ? (
        <AddPersonDialog
          open
          onClose={() => setRunning(null)}
          onCreated={(created) => {
            toast({ title: t('nav.create.created.title'), text: t('nav.create.created.text', { name: fullName(created) }), tone: 'success' });
            navigate(personPath(created.id));
          }}
        />
      ) : null}
      {running === 'process' && person ? <StartProcessDialog person={person} open onClose={() => setRunning(null)} /> : null}
      {running === 'alert' && person ? <AddAlertDialog person={person} open onClose={() => setRunning(null)} /> : null}
      {running === 'event' && person ? (
        <AddEventDialog
          open
          onClose={() => setRunning(null)}
          personId={person.id}
          processIds={data.processes.filter((p) => p.status === 'open' && p.subjectIds.includes(person.id)).map((p) => p.id)}
          recentEvents={data.events.filter((e) => e.subjectIds.includes(person.id)).slice(0, 20)}
        />
      ) : null}
      {running === 'plan' && chosen ? <AddPlanDialog process={chosen} open onClose={() => setRunning(null)} /> : null}
      {running === 'register' && chosen ? <RegisterEntryDialog process={chosen} open onClose={() => setRunning(null)} /> : null}
      {running === 'order' && chosen?.type === 'asp' ? <ProtectionOrderDialog process={chosen} open onClose={() => setRunning(null)} /> : null}
      {running === 'disclosure' && chosen?.type === 'mappa' ? <DisclosureDecisionDialog process={chosen} open onClose={() => setRunning(null)} /> : null}
      {running === 'visit' && chosen?.type === 'awi' ? <SupervisionVisitDialog process={chosen} open onClose={() => setRunning(null)} /> : null}
      {running === 'investigation' && chosen?.type === 'awi' ? <InvestigationDialog process={chosen} open onClose={() => setRunning(null)} /> : null}
    </>
  );
}
