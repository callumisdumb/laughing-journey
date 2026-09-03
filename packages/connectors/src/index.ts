export * from './adapter';
export { MockAdapter, type MappingRule, type FixtureEvent, type MockAdapterSpec } from './mock/base';
export { MOCK_ADAPTERS, adapterById } from './mock/adapters';
export { simulation, setOutage, setDegraded, setLatencyScale, ConnectorDownError } from './mock/simulation';
export * from './gateway';
