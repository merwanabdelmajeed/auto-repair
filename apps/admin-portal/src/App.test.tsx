import { render, screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import App from './App';

const mockAuthState = vi.hoisted(() => ({ isAuthenticated: false, isLoading: false }));

vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => mockAuthState,
}));

vi.mock('./layouts/AppLayout', () => ({ default: () => <div>Layout<Outlet /></div> }));
vi.mock('./pages/Login', () => ({ default: () => <div>LoginPage</div> }));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>DashboardPage</div> }));
vi.mock('./pages/Bookings', () => ({ default: () => <div>BookingsPage</div> }));
vi.mock('./pages/Customers', () => ({ default: () => <div>CustomersPage</div> }));
vi.mock('./pages/Vehicles', () => ({ default: () => <div>VehiclesPage</div> }));
vi.mock('./pages/Services', () => ({ default: () => <div>ServicesPage</div> }));
vi.mock('./pages/Capacity', () => ({ default: () => <div>CapacityPage</div> }));
vi.mock('./pages/BlockedTimes', () => ({ default: () => <div>BlockedTimesPage</div> }));
vi.mock('./pages/Promotions', () => ({ default: () => <div>PromotionsPage</div> }));
vi.mock('./pages/Statistics', () => ({ default: () => <div>StatisticsPage</div> }));
vi.mock('./pages/Settings', () => ({ default: () => <div>SettingsPage</div> }));

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

describe('App routing', () => {
  it('renders nothing while auth is loading', () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = true;
    setPath('/dashboard');
    const { container } = render(<App />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Login at /login when unauthenticated', () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
    setPath('/login');
    render(<App />);
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  it('redirects an unauthenticated user away from a protected route to /login', () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;
    setPath('/dashboard');
    render(<App />);
    expect(screen.getByText('LoginPage')).toBeInTheDocument();
  });

  it('redirects an authenticated user away from /login to /dashboard', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isLoading = false;
    setPath('/login');
    render(<App />);
    expect(screen.getByText('DashboardPage')).toBeInTheDocument();
  });

  it('renders the matched page inside AppLayout for an authenticated user', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isLoading = false;
    setPath('/bookings');
    render(<App />);
    expect(screen.getByText('Layout')).toBeInTheDocument();
    expect(screen.getByText('BookingsPage')).toBeInTheDocument();
  });

  it('redirects the index route to /dashboard when authenticated', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isLoading = false;
    setPath('/');
    render(<App />);
    expect(screen.getByText('DashboardPage')).toBeInTheDocument();
  });

  it('redirects an unknown authenticated path to /dashboard', () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isLoading = false;
    setPath('/nonexistent');
    render(<App />);
    expect(screen.getByText('DashboardPage')).toBeInTheDocument();
  });
});
