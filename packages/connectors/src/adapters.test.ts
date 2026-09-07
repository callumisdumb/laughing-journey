import { describe, expect, it, beforeAll } from 'vitest';
import { AIDEN } from '@mas/mock-data';
import { MOCK_ADAPTERS, adapterById } from './mock/adapters';
import { ConnectorDownError, setLatencyScale, setOutage } from './mock/simulation';

beforeAll(() => setLatencyScale(0));

describe('mock adapters', () => {
  it('registers all ten connectors', () => {
    expect(MOCK_ADAPTERS.map((a) => a.id).sort()).toEqual(['carefirst', 'eclipse', 'emis-web', 'ivpd', 'morse', 'opg', 'scra', 'seemis', 'trakcare', 'visor']);
  });
  it('reports health and honours a simulated outage', async () => {
    const seemis = adapterById('seemis')!;
    expect((await seemis.health()).status).toBe('ok');
    setOutage('seemis', true);
    expect((await seemis.health()).status).toBe('down');
    await expect(seemis.pullEvents({ personId: AIDEN.aiden }, { from: '2026-01-01', to: '2026-12-31' })).rejects.toBeInstanceOf(ConnectorDownError);
    setOutage('seemis', false);
  });
  it('maps source vocabulary to the platform taxonomy', async () => {
    const ivpd = adapterById('ivpd')!;
    const events = await ivpd.pullEvents({ personId: AIDEN.aiden }, { from: '2026-08-01', to: '2026-09-30' });
    expect(events.length).toBe(1);
    expect(events[0]?.mapped.eventType).toBe('police.concern-report');
    expect(events[0]?.mapped.significance).toBe('high');
    expect(events[0]?.mapped.mappingRule).toBe('ivpd.ccr.child-present');
  });
  it('looks people up by name', async () => {
    const emis = adapterById('emis-web')!;
    const matches = await emis.lookupPerson({ familyName: 'Boyle' });
    expect(matches[0]?.displayName).toBe('BOYLE, Aiden');
    expect(await emis.lookupPerson({})).toEqual([]);
  });
  it('checks registers and places flags where supported', async () => {
    const eclipse = adapterById('eclipse')!;
    const reg = await eclipse.registerCheck({ personId: AIDEN.aiden });
    expect(reg.found).toBe(true);
    const receipt = await eclipse.flagRecord({ personId: AIDEN.aiden }, { kind: 'marac', from: '2026-09-02', to: '2027-09-02', contact: 'MARAC Coordinator' });
    expect(receipt.accepted).toBe(true);
    await expect(adapterById('visor')!.pullEvents({ personId: 'x' }, { from: '2020-01-01', to: '2030-01-01' })).resolves.toEqual([]);
    await expect(adapterById('visor')!.registerCheck({ personId: 'x' })).rejects.toThrow();
  });
  it('every mapping rule id is unique within an adapter', () => {
    for (const a of MOCK_ADAPTERS) {
      const ids = a.mapping.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
