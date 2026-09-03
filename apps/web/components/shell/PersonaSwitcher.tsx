'use client';

import { ROLE_DEFINITIONS } from '@mas/domain';
import { useT } from '@mas/messages';
import { AGENCY_GLYPHS, Dialog } from '@mas/ui';
import { useNavigate } from '@/lib/router';
import { useAppStore, useCurrentUser, useData } from '@/lib/store';
import styles from './PersonaSwitcher.module.css';

export function PersonaSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const signIn = useAppStore((s) => s.signIn);
  const navigate = useNavigate();

  const groups = data.organisations.map((org) => ({ org, users: data.users.filter((u) => u.organisationId === org.id) })).filter((g) => g.users.length > 0);

  return (
    <Dialog open={open} onClose={onClose} title={t('nav.personaSwitcher.title')} size="lg">
      <p className={styles.note}>{t('nav.personaSwitcher.note')}</p>
      <div className={styles.groups}>
        {groups.map(({ org, users }) => (
          <div key={org.id}>
            <div className={styles.groupTitle}>{org.name}</div>
            <div className={styles.list}>
              {users.map((u) => {
                const Glyph = AGENCY_GLYPHS[u.agency];
                return (
                  <button
                    key={u.id}
                    type="button"
                    className={styles.persona}
                    aria-current={user?.id === u.id ? 'true' : undefined}
                    onClick={() => {
                      signIn(u.id, true);
                      onClose();
                      navigate('/');
                    }}
                  >
                    <span style={{ color: `var(--color-agency-${u.agency})` }}>
                      <Glyph size={20} variant="filled" />
                    </span>
                    <span>
                      <span className={styles.personaName}>
                        {u.givenName} {u.familyName}
                      </span>
                      <br />
                      <span className={styles.personaRole}>{ROLE_DEFINITIONS[u.roleId].label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
