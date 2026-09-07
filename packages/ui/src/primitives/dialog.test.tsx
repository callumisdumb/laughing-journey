import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import { ConfirmDialog, Dialog } from './Dialog';

/**
 * jsdom implements `<dialog>` but not the top layer, and until recently not `showModal()` at all.
 * These stubs give the element the two behaviours this component depends on, so the test exercises
 * the component's own logic rather than the environment's gaps. The geometry, the top layer and the
 * platform focus trap are covered in `apps/web/e2e/dialogs.spec.ts`, against a real browser, because
 * they are the things jsdom cannot tell the truth about.
 */
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

function Harness({ busy = false, errors }: { busy?: boolean; errors?: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record the three-point test" busy={busy} errors={errors} actions={<button type="button">Save</button>}>
        <p>Body</p>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('locks the page while open and releases it on close', () => {
    render(<Harness />);
    expect(document.body.style.overflow).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.body.style.overflow).toBe('');
  });

  it('releases the page when a dialog is unmounted while still open, which fires no close event', () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    // Navigating away with a modal open. Without the counted lock this leaves the page unscrollable
    // for the rest of the session, with no element left to blame.
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('counts nested dialogs, so the first to close does not unlock the page under the second', () => {
    function Nested() {
      return (
        <>
          <Dialog open onClose={() => {}} title="Outer">
            <p>Outer body</p>
          </Dialog>
          <Dialog open onClose={() => {}} title="Inner">
            <p>Inner body</p>
          </Dialog>
        </>
      );
    }
    const { rerender, unmount } = render(<Nested />);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Dialog open onClose={() => {}} title="Outer">
        <p>Outer body</p>
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('summarises validation failures as an alert', () => {
    render(<Harness errors={['Enter a date', 'Say what happened in one line']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Enter a date');
    expect(alert).toHaveTextContent('Say what happened in one line');
  });

  it('refuses to close while a submission is in flight', () => {
    render(<Harness busy />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toBeDisabled();
    fireEvent.click(close);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('marks a confirmation destructive and passes the caller their own verb', () => {
    render(
      <ConfirmDialog open onClose={() => {}} onConfirm={() => {}} title="Reset demo data?" confirmLabel="Reset demo data">
        <p>This removes every change made on this device.</p>
      </ConfirmDialog>,
    );
    const dialog = document.querySelector('dialog')!;
    expect(dialog).toHaveAttribute('data-tone', 'destructive');
    expect(dialog).toHaveAttribute('data-size', 'sm');
    expect(screen.getByRole('button', { name: 'Reset demo data' })).toHaveAttribute('data-variant', 'danger');
  });
});
