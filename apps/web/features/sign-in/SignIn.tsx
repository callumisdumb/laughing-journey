'use client';

import { ROLE_DEFINITIONS, type Organisation } from '@mas/domain';
import { useT } from '@mas/messages';
import { AGENCY_GLYPHS, Pill, WordmarkGlyph } from '@mas/ui';
import { Info, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useAppStore, useData } from '@/lib/store';
import styles from './SignIn.module.css';

const KIND_LABEL: Record<Organisation['kind'], string> = {
  council: 'Council',
  hscp: 'Health and social care partnership',
  'health-board': 'Health board',
  police: 'Police',
  'third-sector': 'Third sector',
  sps: 'Prison service',
  scra: "Children's Reporter",
  court: 'Court and prosecution',
  regulator: 'Regulator and oversight',
  'fire-rescue': 'Fire and rescue',
};

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
          <WordmarkGlyph size={24} variant="filled" title={t('common.app.name')} />
          <span className={styles.brandText}>{t('common.app.name')}</span>
        </div>
        <div>
          <h1 className={styles.headline} id="signin-title">
            One person. Many processes. One shared picture.
          </h1>
          <p className={styles.lede}>Adult support and protection, child protection, MARAC, MAPPA and Adults with Incapacity, run by the agencies who share the risk, with the person present in their own record.</p>
          <div className={styles.badges}>
            <Pill icon={<ShieldCheck size={14} aria-hidden="true" />}>Need-to-know by design</Pill>
            <Pill icon={<Lock size={14} aria-hidden="true" />}>Every restricted read audited</Pill>
            <Pill icon={<Sparkles size={14} aria-hidden="true" />}>Runs offline</Pill>
          </div>
        </div>
        <div className={styles.demo}>
          <Info size={16} aria-hidden="true" />
          <span>This is a demonstration build. Every person, case, address and number is synthetic. Sign-in is a persona picker in place of your organisation&apos;s single sign-on.</span>
        </div>
      </section>
      <section className={styles.picker} aria-label="Choose organisation and persona">
        <div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>1</span>
            <h2 className={styles.stepTitle}>Your organisation</h2>
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
                    <span className={styles.orgKind}>{KIND_LABEL[o.kind]}</span>
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
              <h2 className={styles.stepTitle}>Who are you today</h2>
            </div>
            <div className={styles.personas} style={{ marginTop: 12 }}>
              {personas.map((u) => (
                <button key={u.id} type="button" className={styles.persona} data-last={last === u.id ? 'true' : undefined} onClick={() => choose(u.id)}>
                  {last === u.id ? (
                    <Pill size="sm" tone="accent" className={styles.lastTag}>
                      Last time
                    </Pill>
                  ) : null}
                  <span className={styles.personaName}>
                    {u.givenName} {u.familyName}
                  </span>
                  <span className={styles.personaRole}>{ROLE_DEFINITIONS[u.roleId].label}</span>
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
