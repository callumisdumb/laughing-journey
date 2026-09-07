'use client';

import { agencyLabel, roleLabel, type Organisation, type User } from '@mas/domain';
import { useT, type MessageKey } from '@mas/messages';
import { AGENCY_GLYPHS, Button, TextField, WordmarkGlyph } from '@mas/ui';
import { ArrowRight, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from '@/lib/router';
import { useAppStore, useData } from '@/lib/store';
import styles from './SignIn.module.css';

/** The kind shown under each organisation in the picker. */
const KIND_KEYS = {
  council: 'home.signIn.orgKinds.council',
  hscp: 'home.signIn.orgKinds.hscp',
  'health-board': 'home.signIn.orgKinds.healthBoard',
  police: 'home.signIn.orgKinds.police',
  'third-sector': 'home.signIn.orgKinds.thirdSector',
  sps: 'home.signIn.orgKinds.sps',
  scra: 'home.signIn.orgKinds.scra',
  court: 'home.signIn.orgKinds.court',
  regulator: 'home.signIn.orgKinds.regulator',
  'fire-rescue': 'home.signIn.orgKinds.fireRescue',
} as const satisfies Record<Organisation['kind'], MessageKey>;

const FILTER_ID = 'signin-filter';

function matches(text: string, ...fields: string[]): boolean {
  const q = text.trim().toLowerCase();
  if (q === '') return true;
  return fields.some((f) => f.toLowerCase().includes(q));
}

/**
 * Choosing who you are, which is what this product's demonstration is about.
 *
 * The screen it replaces is critiqued in `docs/NOTES.md` under its own heading. The short version:
 * two panes that stopped rather than a composition, four hundred pixels of nothing, the honest
 * statement about synthetic data set as a footnote in the least looked at corner, thirteen equal
 * organisation cards making the least interesting decision the largest one, and a remembered persona
 * that was remembered and then hidden behind the choice it was meant to save you.
 *
 * What this one does differently. One surface, edge to edge, with the statement second rather than
 * last. Both columns of the choice visible at once, so answering the first question does not move
 * the second one below the fold. One field that filters organisations and people together, focused
 * on arrival, so the fastest route in is to type a name. And the persona used last time offered
 * before anything else, because the person who most wants to get straight in is the one who has done
 * this before.
 *
 * No credential field, still. A password box that accepts anything is a lie told in the first five
 * seconds of a demonstration about honesty in information sharing.
 */
export function SignIn() {
  const t = useT();
  const data = useData();
  const signIn = useAppStore((s) => s.signIn);
  const navigate = useNavigate();
  const orgListRef = useRef<HTMLDivElement>(null);

  const [last] = useState<string | null>(() => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem('mas.lastPersona');
    } catch {
      return null;
    }
  });
  const [filter, setFilter] = useState('');
  const [orgId, setOrgId] = useState<string | null>(() => (last ? (data.users.find((x) => x.id === last)?.organisationId ?? null) : null));

  const orgs = useMemo(() => data.organisations.filter((o) => data.users.some((u) => u.organisationId === o.id)), [data]);
  const agencyOf = useMemo(() => {
    const map = new Map<string, User['agency']>();
    for (const o of orgs) map.set(o.id, data.users.find((u) => u.organisationId === o.id)?.agency ?? 'social-work');
    return map;
  }, [orgs, data]);

  /**
   * One field, two lists. Typing a person's name narrows the organisations to the ones holding a
   * match and selects the first, so "moira" reaches Moira Gilmour without touching the left column
   * at all. Typing an organisation's name narrows the organisations and leaves its people alone.
   */
  const peopleMatching = useMemo(
    () => data.users.filter((u) => matches(filter, `${u.givenName} ${u.familyName}`, roleLabel(u.roleId), u.jobTitle, agencyLabel(u.agency))),
    [data.users, filter],
  );
  const matchedOrgIds = useMemo(() => new Set(peopleMatching.map((u) => u.organisationId)), [peopleMatching]);
  const visibleOrgs = useMemo(
    () => orgs.filter((o) => matches(filter, o.name, t(KIND_KEYS[o.kind])) || matchedOrgIds.has(o.id)),
    [orgs, filter, matchedOrgIds, t],
  );

  /*
   * The second column always has something in it.
   *
   * Two cases, one rule. On arrival with nothing remembered there is no chosen organisation, and an
   * empty right column beside a full left one is the emptiness this rebuild set out to remove. And
   * filtering can leave the chosen organisation out of the list, which would show people from an
   * organisation the reader can no longer see. Either way, fall to the first organisation on screen.
   *
   * Derived rather than corrected by an effect, so there is no frame where the two columns disagree
   * and no setState on arrival. It is a default rather than an answer: the list shows which one is
   * selected, a click changes it, and typing a person's name selects the organisation holding them,
   * which is the whole point of one field over two. Clearing the filter returns to the chosen one
   * rather than keeping the substitute, because a filter is a view and not a change.
   */
  const orgOnScreen = orgId && visibleOrgs.some((o) => o.id === orgId) ? orgId : (visibleOrgs[0]?.id ?? null);

  const personas = useMemo(() => {
    if (!orgOnScreen) return [];
    const inOrg = data.users.filter((u) => u.organisationId === orgOnScreen);
    const narrowed = filter.trim() === '' ? inOrg : inOrg.filter((u) => peopleMatching.includes(u));
    return [...(narrowed.length > 0 ? narrowed : inOrg)].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  }, [orgOnScreen, data.users, filter, peopleMatching]);

  const org = orgOnScreen ? orgs.find((o) => o.id === orgOnScreen) : undefined;
  const remembered = last ? data.users.find((u) => u.id === last) : undefined;
  const rememberedOrg = remembered ? orgs.find((o) => o.id === remembered.organisationId) : undefined;


  // Focused on arrival, because the fastest way in is to type a name and this screen has one job.
  useEffect(() => {
    document.getElementById(FILTER_ID)?.focus();
  }, []);

  function choose(userId: string) {
    signIn(userId);
    navigate('/', { replace: true });
  }

  /** Up and down walk the organisation list, so the whole screen is reachable without a pointer. */
  function onOrgKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = [...(orgListRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    e.preventDefault();
    const next = buttons[(at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    next?.click();
  }

  return (
    <div className={styles.screen} data-app-ready="true">
      <header className={styles.masthead}>
        <div className={styles.mastheadInner}>
          <div className={styles.brand}>
            <WordmarkGlyph size={24} variant="filled" title={t('product.name')} />
            <span className={styles.brandText}>{t('product.name')}</span>
          </div>
          <h1 className={styles.headline}>{t('home.signIn.headline')}</h1>
          <p className={styles.lede}>{t('home.signIn.lede')}</p>
        </div>
      </header>

      <div className={styles.body}>
        {/*
          Second, not last. This is the honest thing the screen has to say and it used to be a
          footnote in the corner nobody reads.
        */}
        <div className={styles.statement}>
          <p className={styles.statementLead}>{t('home.signIn.demoStatement')}</p>
          <p className={styles.statementText}>{t('home.signIn.demoSignIn')}</p>
        </div>

        {remembered && rememberedOrg ? (
          <div className={styles.resume}>
            <span className={styles.resumeIcon} style={{ color: `var(--color-agency-${remembered.agency})` }}>
              {(() => {
                const Glyph = AGENCY_GLYPHS[remembered.agency];
                return <Glyph size={24} variant="filled" />;
              })()}
            </span>
            <span className={styles.resumeText}>
              <span className={styles.resumeTitle}>{t('home.signIn.resume.title')}</span>
              <span className={styles.resumeMeta}>{t('home.signIn.resume.meta', { name: `${remembered.givenName} ${remembered.familyName}`, role: roleLabel(remembered.roleId), organisation: rememberedOrg.name })}</span>
            </span>
            <Button variant="primary" icon={<ArrowRight size={16} aria-hidden="true" />} onClick={() => choose(remembered.id)}>
              {t('home.signIn.resume.action')}
            </Button>
          </div>
        ) : null}

        <section className={styles.picker} aria-label={t('home.signIn.pickerLabel')}>
          <div className={styles.filter}>
            <Search size={16} aria-hidden="true" className={styles.filterIcon} />
            <TextField
              id={FILTER_ID}
              label={t('home.signIn.filter.label')}
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('home.signIn.filter.placeholder')}
              className={styles.filterField}
            />
            <p className={styles.filterCount} role="status">
              {t('home.signIn.filter.results', { count: visibleOrgs.length })}
            </p>
          </div>

          <div className={styles.columns}>
            <div className={styles.column}>
              <h2 className={styles.stepTitle}>{t('home.signIn.orgStep')}</h2>
              <p className={styles.stepMeta}>{t('home.signIn.orgStepMeta', { count: visibleOrgs.length })}</p>
              <p className={styles.stepHint}>{t('home.signIn.chooseHint')}</p>
              <div className={styles.orgs} ref={orgListRef}>
                {visibleOrgs.map((o) => {
                  const agency = agencyOf.get(o.id) ?? 'social-work';
                  const Glyph = AGENCY_GLYPHS[agency];
                  return (
                    <button key={o.id} type="button" className={styles.org} aria-pressed={orgOnScreen === o.id} onClick={() => setOrgId(o.id)} onKeyDown={onOrgKeyDown}>
                      <span className={styles.orgGlyph} style={{ color: `var(--color-agency-${agency})` }}>
                        <Glyph size={20} variant="filled" />
                      </span>
                      <span className={styles.orgText}>
                        <span className={styles.orgName}>{o.name}</span>
                        <span className={styles.orgKind}>{t(KIND_KEYS[o.kind])}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.column}>
              <h2 className={styles.stepTitle}>{t('home.signIn.personaStep')}</h2>
              <p className={styles.stepMeta}>{org ? t('home.signIn.personaStepMeta', { count: personas.length, organisation: org.name }) : t('home.signIn.personaStepWaiting')}</p>
              <p className={styles.stepHint}>{t('home.signIn.signedInAs')}</p>
              <div className={styles.personas}>
                {personas.map((u) => (
                  <button key={u.id} type="button" className={styles.persona} data-last={last === u.id ? 'true' : undefined} onClick={() => choose(u.id)}>
                    <span className={styles.personaName}>
                      {u.givenName} {u.familyName}
                    </span>
                    <span className={styles.personaRole}>{roleLabel(u.roleId)}</span>
                    <span className={styles.personaBlurb}>{u.blurb}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
