import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import Settings from './Settings';
import { deleteAdminUser } from '../api/adminUsers';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'me', role: 'TENANT_OWNER', email: 'me@shop.com' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    completeNewPassword: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../api/adminUsers', () => ({
  listAdminUsers: vi.fn().mockResolvedValue([
    { userId: 'me', email: 'me@shop.com', firstName: '', lastName: '', role: 'TENANT_OWNER', locationIds: [], status: 'ACTIVE', createdAt: '' },
    { userId: 'other', email: 'other@shop.com', firstName: '', lastName: '', role: 'LOCATION_MANAGER', locationIds: [], status: 'ACTIVE', createdAt: '' },
  ]),
  inviteAdminUser: vi.fn(),
  updateAdminUser: vi.fn(),
  deleteAdminUser: vi.fn(),
}));

vi.mock('../api/locations', () => ({
  listLocations: vi.fn().mockResolvedValue([]),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
}));

vi.mock('../api/tenant', () => ({
  getTenant: vi.fn().mockResolvedValue({ tenantId: 't1', name: 'Shop', email: 'x@x.com', plan: 'STARTER', status: 'ACTIVE' }),
  updateTenant: vi.fn(),
}));

describe('Settings > Roles & Access', () => {
  beforeEach(() => vi.clearAllMocks());

  it("hides the Deactivate/Reactivate button on the current user's own row", async () => {
    render(<Settings />);

    const meRow = (await screen.findByText('me@shop.com')).closest('tr')!;
    const otherRow = screen.getByText('other@shop.com').closest('tr')!;

    expect(within(meRow).queryByRole('button', { name: /Deactivate|Reactivate/ })).not.toBeInTheDocument();
    expect(within(otherRow).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it("hides the Delete button on the current user's own row, shows it on other rows", async () => {
    render(<Settings />);

    const meRow = (await screen.findByText('me@shop.com')).closest('tr')!;
    const otherRow = screen.getByText('other@shop.com').closest('tr')!;

    expect(within(meRow).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(within(otherRow).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('deletes the target user after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Settings />);

    const otherRow = (await screen.findByText('other@shop.com')).closest('tr')!;
    fireEvent.click(within(otherRow).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteAdminUser).toHaveBeenCalledWith('other'));
  });

  it('does not delete when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<Settings />);

    const otherRow = (await screen.findByText('other@shop.com')).closest('tr')!;
    fireEvent.click(within(otherRow).getByRole('button', { name: 'Delete' }));

    expect(deleteAdminUser).not.toHaveBeenCalled();
  });
});
