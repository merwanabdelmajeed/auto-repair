import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import StatusPickerModal from './StatusPickerModal';

describe('StatusPickerModal', () => {
  it('shows a forward-transition button for each valid next status except cancelled', () => {
    render(
      <StatusPickerModal visible currentStatus="pending" validNext={['confirmed', 'cancelled']} onSelect={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('Move to Confirmed')).toBeTruthy();
    expect(screen.queryByText(/Move to Cancelled/)).toBeNull();
  });

  it('formats the "in-progress" status as "In Progress"', () => {
    render(
      <StatusPickerModal visible currentStatus="in-progress" validNext={['completed']} onSelect={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.getByText('In Progress')).toBeTruthy();
    expect(screen.getByText('Move to Completed')).toBeTruthy();
  });

  it('shows the Cancel Appointment button only when cancelled is a valid transition', () => {
    render(
      <StatusPickerModal visible currentStatus="confirmed" validNext={['in-progress']} onSelect={() => {}} onDismiss={() => {}} />,
    );
    expect(screen.queryByText('Cancel Appointment')).toBeNull();
  });

  it('calls onDismiss then onSelect when a forward status is pressed', () => {
    const onSelect = jest.fn();
    const onDismiss = jest.fn();
    render(
      <StatusPickerModal visible currentStatus="confirmed" validNext={['in-progress', 'cancelled']} onSelect={onSelect} onDismiss={onDismiss} />,
    );

    fireEvent.press(screen.getByText('Move to In Progress'));

    expect(onDismiss).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('in-progress');
  });

  it('calls onDismiss then onSelect("cancelled") when Cancel Appointment is pressed', () => {
    const onSelect = jest.fn();
    const onDismiss = jest.fn();
    render(
      <StatusPickerModal visible currentStatus="confirmed" validNext={['in-progress', 'cancelled']} onSelect={onSelect} onDismiss={onDismiss} />,
    );

    fireEvent.press(screen.getByText('Cancel Appointment'));

    expect(onDismiss).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('cancelled');
  });

  it('dismisses when the Dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    render(
      <StatusPickerModal visible currentStatus="confirmed" validNext={['in-progress']} onSelect={() => {}} onDismiss={onDismiss} />,
    );

    fireEvent.press(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
