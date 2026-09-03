'use client';

import { roleLabel, type Organisation } from '@mas/domain';
import { useT, type MessageKey } from '@mas/messages';
import { AGENCY_GLYPHS, Pill, WordmarkGlyph } from '@mas/ui';
import { Info, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
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

export function SignIn() {
  const t = useT();
  const data = useData();
  const signIn = useAppStore((s) => s.signIn);
  const navigate = useNavigate();
  const [last] = useState<string | null>(() => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem('mas.lastPersona');
    } catch {
      return null;
    }
  });
  const [orgId, setOrgId] = useState<string | null>(() => (last ? (data.users.find((x) => x.id === last)?.organisationId ?? null) : null));

  const orgs = data.organisations.filter((o) => data.users.some((u) => u.organisationId === o.id));
  const personas = orgId ? data.users.filter((u) => u.organisationId === orgId).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))) : [];

  function choose(userId: string) {
    signIn(userId);
    navigate('/', { replace: true });
  }

  return (
    <div className={styles.screen} data-app-ready="true">
      <section className={styles.intro} aria-labelledby="signin-title">
        <div className={styles.brand}>
          <WordmarkGlyph size={24} variant="filled" title={t('product.name')} />
          <span className={styles.brandText}>{t('product.name')}</span>
        </div>
        <div>
          <h1 className={styles.headline} id="signin-title">
            {t('home.signIn.headline')}
          </h1>
          <p className={styles.lede}>{t('home.signIn.lede')}</p>
          <div className={styles.badges}>
            <Pill icon={<ShieldCheck size={14} aria-hidden="true" />}>{t('home.signIn.badges.needToKnow')}</Pill>
            <Pill icon={<Lock size={14} aria-hidden="true" />}>{t('home.signIn.badges.audited')}</Pill>
            <Pill icon={<Sparkles size={14} aria-hidden="true" />}>{t('home.signIn.badges.offline')}</Pill>
          </div>
        </div>
        <div className={styles.demo}>
          <Info size={16} aria-hidden="true" />
          <span>{t('home.signIn.demoNote')}</span>
        </div>
      </section>
      <section className={styles.picker} aria-label={t('home.signIn.pickerLabel')}>
        <div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>1</span>
            <h2 className={styles.stepTitle}>{t('home.signIn.orgStep')}</h2>
          </div>
          <div className={styles.orgs} style={{ marginTop: 12 }}>
            {orgs.map((o) => {
              const agency = data.users.find((u) => u.organisationId === o.id)?.agency ?? 'social-work';
              const Glyph = AGENCY_GLYPHS[agency];
              return (
                <button key={o.id} type="button" className={styles.org} aria-pressed={orgId === o.id} onClick={() => setOrgId(o.id)}>
                  <span style={{ color: `var(--color-agency-${agency})` }}>
                    <Glyph size={24} variant="filled" />
                  </span>
                  <span>
                    <span className={styles.orgName}>{o.name}</span>
                    <br />
                    <span className={styles.orgKind}>{t(KIND_KEYS[o.kind])}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {orgId ? (
          <div>
            <div className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <h2 className={styles.stepTitle}>{t('home.signIn.personaStep')}</h2>
            </div>
            <div className={styles.personas} style={{ marginTop: 12 }}>
              {personas.map((u) => (
                <button key={u.id} type="button" className={styles.persona} data-last={last === u.id ? 'true' : undefined} onClick={() => choose(u.id)}>
                  {last === u.id ? (
                    <Pill size="sm" tone="accent" className={styles.lastTag}>
                      {t('home.signIn.lastTime')}
                    </Pill>
                  ) : null}
                  <span className={styles.personaName}>
                    {u.givenName} {u.familyName}
                  </span>
                  <span className={styles.personaRole}>{roleLabel(u.roleId)}</span>
                  <span className={styles.personaBlurb}>{u.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
