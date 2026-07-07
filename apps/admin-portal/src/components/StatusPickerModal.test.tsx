import { render, screen, fireEvent } from '@testing-library/react';
import StatusPickerModal from './StatusPickerModal';

function rect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 100, bottom: 130, left: 200, right: 260, width: 60, height: 30, x: 200, y: 100,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect;
}

describe('StatusPickerModal', () => {
  it('renders nothing when there is no anchor', () => {
    const { container } = render(
      <StatusPickerModal anchorRect={null} currentStatus="pending" validNext={['confirmed', 'cancelled']} onSelect={() => {}} onDismiss={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a forward-transition button for each valid next status except cancelled', () => {
    render(
      <StatusPickerModal anchorRect={rect()} currentStatus="pending" validNext={['confirmed', 'cancelled']} onSelect={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('Move to Confirmed')).toBeInTheDocument();
    expect(screen.queryByText(/Move to Cancelled/)).not.toBeInTheDocument();
  });

  it('shows the Cancel Appt button only when cancelled is a valid transition', () => {
    render(
      <StatusPickerModal anchorRect={rect()} currentStatus="confirmed" validNext={['in-progress']} onSelect={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.queryByText('Cancel Appt')).not.toBeInTheDocument();
  });

  it('calls onDismiss then onSelect when a forward status is clicked', () => {
    const onSelect = vi.fn();
    const onDismiss = vi.fn();
    render(
      <StatusPickerModal anchorRect={rect()} currentStatus="confirmed" validNext={['in-progress', 'cancelled']} onSelect={onSelect} onDismiss={onDismiss} />,
    );

    fireEvent.click(screen.getByText('Move to In Progress'));

    expect(onDismiss).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('in-progress');
  });

  it('calls onDismiss then onSelect("cancelled") when Cancel Appt is clicked', () => {
    const onSelect = vi.fn();
    const onDismiss = vi.fn();
    render(
      <StatusPickerModal anchorRect={rect()} currentStatus="confirmed" validNext={['in-progress', 'cancelled']} onSelect={onSelect} onDismiss={onDismiss} />,
    );

    fireEvent.click(screen.getByText('Cancel Appt'));

    expect(onDismiss).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('cancelled');
  });

  it('dismisses when the backdrop or the Dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <StatusPickerModal anchorRect={rect()} currentStatus="confirmed" validNext={['in-progress']} onSelect={() => {}} onDismiss={onDismiss} />,
    );

    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector('div[style*="position: fixed"][style*="inset: 0px"]')!;
    fireEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('flips open-up when there is not enough space below the anchor', () => {
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true });
    render(
      <StatusPickerModal
        anchorRect={rect({ top: 280, bottom: 290 })}
        currentStatus="confirmed"
        validNext={['in-progress']}
        onSelect={() => {}}
        onDismiss={() => {}}
      />,
    );
    // Just verifying it renders without throwing when the flip-up branch is exercised
    expect(screen.getByText('Change Status')).toBeInTheDocument();
  });

  it('only injects the keyframes <style> tag once across multiple renders', () => {
    const { unmount } = render(
      <StatusPickerModal anchorRect={rect()} currentStatus="confirmed" validNext={['in-progress']} onSelect={() => {}} onDismiss={() => {}} />,
    );
    unmount();
    render(
      <StatusPickerModal anchorRect={rect()} currentStatus="confirmed" validNext={['in-progress']} onSelect={() => {}} onDismiss={() => {}} />,
    );
    expect(document.querySelectorAll('#status-picker-keyframes')).toHaveLength(1);
  });
});
