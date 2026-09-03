import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BUNDLED, formatDate, formatDateTime, formatMessage, formatNumber, formatTime, messageArguments, resetAllOverrides, setOverride, t, validateMessage } from './index';
import { MessagesProvider, useT } from './provider';

afterEach(() => resetAllOverrides());

describe('catalogue', () => {
  it('flattens the bundled catalogue to dot keys', () => {
    expect(BUNDLED['common.app.name']).toBe('Platform');
  });
  it('renders ICU arguments, plurals and selects', () => {
    expect(formatMessage('{count, plural, one {# action} other {# actions}} due', { count: 1 })).toBe('1 action due');
    expect(formatMessage('{count, plural, one {# action} other {# actions}} due', { count: 3 })).toBe('3 actions due');
    expect(formatMessage('{role, select, chair {the chair} other {a member}}', { role: 'chair' })).toBe('the chair');
    expect(formatMessage('Signed in as {name}', { name: 'Janet Kerr' })).toBe('Signed in as Janet Kerr');
  });
  it('renders a broken message as its own text rather than nothing', () => {
    expect(formatMessage('Unbalanced {brace')).toBe('Unbalanced {brace');
    expect(validateMessage('Unbalanced {brace')).toBeDefined();
    expect(validateMessage('Fine {name}')).toBeUndefined();
  });
  it('lists the arguments a message uses', () => {
    expect(messageArguments('{count, plural, one {# item for {name}} other {# items}}')).toEqual(['count', 'name']);
  });
});

describe('overrides', () => {
  it('layers a session override over the bundled text and resets', () => {
    expect(t('common.app.name')).toBe('Platform');
    setOverride('common.app.name', 'Lantern');
    expect(t('common.app.name')).toBe('Lantern');
    resetAllOverrides();
    expect(t('common.app.name')).toBe('Platform');
  });
  it('re-renders components when an override changes', () => {
    function Name() {
      const tr = useT();
      return <h1>{tr('common.app.name')}</h1>;
    }
    render(
      <MessagesProvider>
        <Name />
      </MessagesProvider>,
    );
    expect(screen.getByRole('heading')).toHaveTextContent('Platform');
    act(() => setOverride('common.app.name', 'Lantern'));
    expect(screen.getByRole('heading')).toHaveTextContent('Lantern');
  });
});

describe('intl helpers', () => {
  it('formats dates as dd Mon yyyy in Europe/London, September included', () => {
    expect(formatDate('2026-09-02')).toBe('02 Sep 2026');
    expect(formatDate('2026-09-02T09:00:00+01:00')).toBe('02 Sep 2026');
    expect(formatDate('2026-03-29T00:30:00Z')).toBe('29 Mar 2026');
    expect(formatTime('2026-06-15T13:05:00+01:00')).toBe('13:05');
    expect(formatDateTime('2026-06-15T13:05:00+01:00')).toBe('15 Jun 2026, 13:05');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});
