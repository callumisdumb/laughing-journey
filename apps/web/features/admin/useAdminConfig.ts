'use client';

import { ROLE_DEFINITIONS, configSchema, type Config } from '@mas/domain';
import { useT } from '@mas/messages';
import { useToast } from '@mas/ui';
import { useAppStore, useConfig, useCurrentUser } from '@/lib/store';

export interface SaveResult {
  ok: boolean;
  /** Field-level messages from the schema, as "path: message". Empty when ok. */
  errors: string[];
}

export interface AdminConfigApi {
  config: Config;
  /** Only roles with oversight 'admin' may change configuration. */
  canEdit: boolean;
  /** Validate the whole config, persist it, audit the change and toast "Saved". */
  save: (next: Config, section: string, label: string) => SaveResult;
}

/**
 * Every admin edit goes through here: the whole config is validated with the Zod schema
 * before it is stored, the change is audited against the section, and the user is told.
 */
export function useAdminConfig(): AdminConfigApi {
  const t = useT();
  const config = useConfig();
  const user = useCurrentUser();
  const setConfig = useAppStore((s) => s.setConfig);
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const canEdit = user ? ROLE_DEFINITIONS[user.roleId].oversight === 'admin' : false;

  function save(next: Config, section: string, label: string): SaveResult {
    if (!canEdit) return { ok: false, errors: [t('admin.readOnly.error')] };
    const parsed = configSchema.safeParse(next);
    if (!parsed.success) {
      return { ok: false, errors: parsed.error.issues.map((i) => t('admin.config.issue', { path: i.path.map(String).join('.'), message: i.message })) };
    }
    setConfig(parsed.data);
    audit({ act: 'edit', targetType: 'config', targetId: section, targetLabel: label });
    toast({ title: t('admin.config.savedToast'), text: label, tone: 'success' });
    return { ok: true, errors: [] };
  }

  return { config, canEdit, save };
}
