import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { ClockNumeral } from './ClockNumeral';
import { DateField } from './DateField';
import { AgencyMark, RiskBand } from './Marks';
import { RestrictedState } from './States';

describe('primitives', () => {
  it('renders a button with variant data attribute', () => {
    render(<Button variant="primary">Record decision</Button>);
    const b = screen.getByRole('button', { name: 'Record decision' });
    expect(b).toHaveAttribute('data-variant', 'primary');
  });
  it('renders a clock with an accessible label', () => {
    render(<ClockNumeral daysRemaining={12} band="low" status="running" label="Review CPPM" />);
    expect(screen.getByLabelText('Review CPPM: 12 days remaining')).toBeInTheDocument();
  });
  it('renders an overdue clock', () => {
    render(<ClockNumeral daysRemaining={-3} band="critical" status="overdue" label="Inquiry decision" />);
    expect(screen.getByLabelText('Inquiry decision: 3 days overdue')).toBeInTheDocument();
  });
  it('pairs risk colour with a word and an icon', () => {
    const { container } = render(<RiskBand band="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
  it('renders an agency mark with glyph and label', () => {
    const { container } = render(<AgencyMark agency="police" />);
    expect(screen.getByText('Police')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
  it('explains break-glass availability', () => {
    render(<RestrictedState reason="Not on the distribution list." breakGlass="unavailable" />);
    expect(screen.getByText(/not available for your agency/)).toBeInTheDocument();
  });

  it('shows a typed date as dd Mon yyyy and hands the form a calendar date', () => {
    function Harness() {
      const [value, setValue] = useState('2026-09-02');
      return (
        <>
          <DateField label="Date completed" value={value} onChange={setValue} />
          <output data-testid="value">{value}</output>
        </>
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText<HTMLInputElement>('Date completed');
    expect(input.value).toBe('02 Sep 2026');
    expect(input).toHaveAccessibleDescription('dd Mon yyyy, for example 02 Sep 2026');
    fireEvent.change(input, { target: { value: '14/9/2026' } });
    expect(screen.getByTestId('value')).toHaveTextContent('2026-09-14');
    fireEvent.blur(input);
    expect(input.value).toBe('14 Sep 2026');
    fireEvent.change(input, { target: { value: '31 Feb 2026' } });
    expect(screen.getByTestId('value')).toHaveTextContent('31 Feb 2026');
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the date as dd Mon yyyy, for example 02 Sep 2026');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
