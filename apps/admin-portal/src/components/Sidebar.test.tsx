import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('renders every nav item when open', () => {
    render(<MemoryRouter><Sidebar isOpen /></MemoryRouter>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('still renders (collapsed width) when closed', () => {
    render(<MemoryRouter><Sidebar isOpen={false} /></MemoryRouter>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('marks the current route\'s link active', () => {
    render(
      <MemoryRouter initialEntries={['/bookings']}>
        <Sidebar isOpen />
      </MemoryRouter>,
    );
    const link = screen.getByText('Bookings').closest('a');
    expect(link).toHaveAttribute('aria-current', 'page');
  });
});
