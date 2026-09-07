import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu';

/**
 * The menu button pattern, held to its keyboard contract: open on click, focus on the first item,
 * arrows move, Escape closes and hands focus back, and the destructive item sits last behind a rule.
 */
describe('Menu', () => {
  function subject() {
    const merge = vi.fn();
    const death = vi.fn();
    render(
      <Menu
        label="More"
        items={[
          { id: 'merge', label: 'Merge with another record', onSelect: merge },
          { id: 'death', label: 'Record a death', onSelect: death, destructive: true, separatorBefore: true },
        ]}
      />,
    );
    return { merge, death };
  }

  it('is closed until pressed, then opens with focus on the first item', () => {
    subject();
    const button = screen.getByRole('button', { name: 'More' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
    expect(document.activeElement).toBe(items[0]);
  });

  it('moves with the arrow keys, wraps, and closes on Escape with focus back on the button', () => {
    subject();
    const button = screen.getByRole('button', { name: 'More' });
    fireEvent.click(button);
    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('runs the item and closes, and keeps the destructive item last and separated', () => {
    const { merge, death } = subject();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('separator')).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    expect(items[1]).toHaveAttribute('data-tone', 'destructive');
    expect(items[1]).toHaveTextContent('Record a death');
    fireEvent.click(items[0]!);
    expect(merge).toHaveBeenCalledTimes(1);
    expect(death).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
