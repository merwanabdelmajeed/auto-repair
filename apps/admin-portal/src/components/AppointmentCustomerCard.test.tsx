import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import AppointmentCustomerCard from './AppointmentCustomerCard';
import type { Appointment } from '../api/appointments';

function appt(overrides: Partial<Appointment> = {}): Appointment {
  return {
    appointmentId: 'a1', customerId: 'c1', customerEmail: 'jane@shop.com', customerName: 'Jane Doe',
    vehicleId: 'v1', serviceId: 's1', scheduledAt: '2099-06-01T14:00:00.000Z', status: 'pending',
    notes: '', promoCode: null, promoId: null, promoApplied: false, serviceName: 'Oil Change',
    vehicleSummary: '2020 Honda Civic', createdAt: 'c', updatedAt: 'u',
    ...overrides,
  };
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname}{loc.search}</div>;
}

function renderCard(a: Appointment, phone: string | null | undefined) {
  return render(
    <MemoryRouter initialEntries={['/bookings']}>
      <Routes>
        <Route path="/bookings" element={<AppointmentCustomerCard appt={a} phone={phone} />} />
        <Route path="/customers" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppointmentCustomerCard', () => {
  it('shows name, phone and email', () => {
    renderCard(appt(), '555-1234');
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('555-1234')).toBeInTheDocument();
    expect(screen.getByText('jane@shop.com')).toBeInTheDocument();
  });

  it('shows a dash for a missing phone and email', () => {
    renderCard(appt({ customerEmail: undefined }), null);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('navigates to the customer details when the name is clicked', () => {
    renderCard(appt(), '555-1234');
    fireEvent.click(screen.getByRole('link'));
    expect(screen.getByTestId('location')).toHaveTextContent('/customers?customerId=c1&open=1');
  });

  it('renders the name as plain text when the customer account was deleted', () => {
    renderCard(appt({ customerId: undefined, customerName: 'Deleted Customer' }), undefined);
    expect(screen.getByText('Deleted Customer')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
