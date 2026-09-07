import { describe, expect, it } from 'vitest';
import { ROLE_DEFINITIONS, type RoleId } from '../enums';
import { CREATABLE, canCreate } from './create';

const ROLES = Object.keys(ROLE_DEFINITIONS) as RoleId[];

describe('canCreate', () => {
  it('lets a practitioner create a person', () => {
    expect(canCreate('social-worker-adults', 'person')).toEqual({ allowed: true });
  });

  it('refuses every oversight role, with a reason and a route', () => {
    const oversight = ROLES.filter((id) => {
      const kind = ROLE_DEFINITIONS[id].oversight;
      return kind === 'read-only' || kind === 'audit' || kind === 'redacted';
    });
    expect(oversight.length).toBeGreaterThan(0);
    for (const id of oversight) {
      const decision = canCreate(id, 'person');
      expect(decision.allowed).toBe(false);
      if (decision.allowed) continue;
      expect(decision.reason.length).toBeGreaterThan(10);
      expect(decision.route.length).toBeGreaterThan(10);
    }
  });

  it('refuses the system administrator everything but an event', () => {
    for (const entity of CREATABLE) {
      expect(canCreate('system-administrator', entity).allowed).toBe(entity === 'event');
    }
  });

  it('never returns a refusal without somewhere else to go', () => {
    for (const id of ROLES) {
      for (const entity of CREATABLE) {
        const decision = canCreate(id, entity);
        if (!decision.allowed) expect(decision.route).not.toBe('');
      }
    }
  });
});
