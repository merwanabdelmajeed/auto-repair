import { api } from './client';
import * as adminUsers from './adminUsers';
import * as analytics from './analytics';
import * as appointments from './appointments';
import * as blockedTimes from './blockedTimes';
import * as campaigns from './campaigns';
import * as capacity from './capacity';
import * as customers from './customers';
import * as dashboard from './dashboard';
import * as locations from './locations';
import * as notifications from './notifications';
import * as promotions from './promotions';
import * as services from './services';
import * as tenant from './tenant';
import * as vehicles from './vehicles';

vi.mock('./client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

beforeEach(() => vi.clearAllMocks());

describe('adminUsers api', () => {
  it('listAdminUsers', () => {
    adminUsers.listAdminUsers();
    expect(api.get).toHaveBeenCalledWith('/admin-users');
  });
  it('inviteAdminUser', () => {
    adminUsers.inviteAdminUser({ email: 'a@x.com', role: 'TENANT_OWNER', locationIds: ['loc1'] });
    expect(api.post).toHaveBeenCalledWith('/admin-users', expect.objectContaining({ email: 'a@x.com' }));
  });
  it('updateAdminUser', () => {
    adminUsers.updateAdminUser('u1', { status: 'INACTIVE' });
    expect(api.patch).toHaveBeenCalledWith('/admin-users/u1', { status: 'INACTIVE' });
  });
  it('deleteAdminUser', () => {
    adminUsers.deleteAdminUser('u1');
    expect(api.delete).toHaveBeenCalledWith('/admin-users/u1');
  });
});

describe('analytics api', () => {
  it('getAnalytics', () => {
    analytics.getAnalytics('2026-01-01', '2026-01-31');
    expect(api.get).toHaveBeenCalledWith('/analytics?startDate=2026-01-01&endDate=2026-01-31');
  });
});

describe('appointments api', () => {
  it('listAppointments without a cursor', () => {
    appointments.listAppointments();
    expect(api.get).toHaveBeenCalledWith('/appointments?limit=25');
  });
  it('listAppointments with a cursor, URL-encoded', () => {
    appointments.listAppointments('a b', 10);
    expect(api.get).toHaveBeenCalledWith('/appointments?limit=10&cursor=a%20b');
  });
  it('updateAppointmentStatus', () => {
    appointments.updateAppointmentStatus('a1', 'confirmed');
    expect(api.patch).toHaveBeenCalledWith('/appointments/a1/status', { status: 'confirmed' });
  });
  it('applyPromo', () => {
    appointments.applyPromo('p1', 'c1', 'a1');
    expect(api.post).toHaveBeenCalledWith('/promotions/p1/apply', { customerId: 'c1', appointmentId: 'a1' });
  });
});

describe('blockedTimes api', () => {
  it('listBlockedTimes', () => {
    blockedTimes.listBlockedTimes('loc 1');
    expect(api.get).toHaveBeenCalledWith('/blocked-times?locationId=loc%201');
  });
  it('createBlockedTime merges locationId into the body', () => {
    blockedTimes.createBlockedTime('loc1', { label: 'Holiday', startDate: '2026-01-01', endDate: '2026-01-01' });
    expect(api.post).toHaveBeenCalledWith('/blocked-times', { label: 'Holiday', startDate: '2026-01-01', endDate: '2026-01-01', locationId: 'loc1' });
  });
  it('deleteBlockedTime', () => {
    blockedTimes.deleteBlockedTime('b1');
    expect(api.delete).toHaveBeenCalledWith('/blocked-times/b1');
  });
});

describe('campaigns api', () => {
  it('listCampaigns', () => {
    campaigns.listCampaigns();
    expect(api.get).toHaveBeenCalledWith('/campaigns');
  });
  it('createCampaign', () => {
    const input = { name: 'N', subject: 'S', body: 'B', targetAudience: 'all' as const };
    campaigns.createCampaign(input);
    expect(api.post).toHaveBeenCalledWith('/campaigns', input);
  });
  it('sendCampaign', () => {
    campaigns.sendCampaign('c1');
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/send', {});
  });
});

describe('capacity api', () => {
  it('getCapacity', () => {
    capacity.getCapacity('loc1');
    expect(api.get).toHaveBeenCalledWith('/capacity?locationId=loc1');
  });
  it('updateCapacity merges locationId into the body', () => {
    capacity.updateCapacity('loc1', { maxConcurrent: 5 });
    expect(api.put).toHaveBeenCalledWith('/capacity', { maxConcurrent: 5, locationId: 'loc1' });
  });
});

describe('customers api', () => {
  it('listCustomers without a cursor uses the default limit', () => {
    customers.listCustomers();
    expect(api.get).toHaveBeenCalledWith('/customers?limit=25');
  });
  it('listCustomers with a cursor', () => {
    customers.listCustomers('cur1', 50);
    expect(api.get).toHaveBeenCalledWith('/customers?limit=50&cursor=cur1');
  });
});

describe('dashboard api', () => {
  it('getDashboardSummary passes today\'s local date as YYYY-MM-DD', () => {
    dashboard.getDashboardSummary();
    expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/^\/dashboard\/summary\?localDate=\d{4}-\d{2}-\d{2}$/));
  });
});

describe('locations api', () => {
  it('listLocations', () => {
    locations.listLocations();
    expect(api.get).toHaveBeenCalledWith('/locations');
  });
  it('createLocation', () => {
    const input = { name: 'Shop', address: '1 Main St' };
    locations.createLocation(input);
    expect(api.post).toHaveBeenCalledWith('/locations', input);
  });
  it('updateLocation', () => {
    locations.updateLocation('loc1', { name: 'Shop', address: '1 Main St' });
    expect(api.put).toHaveBeenCalledWith('/locations/loc1', { name: 'Shop', address: '1 Main St' });
  });
  it('deleteLocation', () => {
    locations.deleteLocation('loc1');
    expect(api.delete).toHaveBeenCalledWith('/locations/loc1');
  });
});

describe('notifications api', () => {
  it('getNotifications', () => {
    notifications.getNotifications();
    expect(api.get).toHaveBeenCalledWith('/notifications');
  });
  it('markRead', () => {
    notifications.markRead('n1');
    expect(api.put).toHaveBeenCalledWith('/notifications/n1/read', {});
  });
  it('markAllRead', () => {
    notifications.markAllRead();
    expect(api.put).toHaveBeenCalledWith('/notifications/read-all', {});
  });
});

describe('promotions api', () => {
  it('listPromotions', () => {
    promotions.listPromotions();
    expect(api.get).toHaveBeenCalledWith('/promotions');
  });
  it('createPromotion', () => {
    const input = { code: 'SAVE10', description: '', type: 'percent' as const, value: 10 };
    promotions.createPromotion(input);
    expect(api.post).toHaveBeenCalledWith('/promotions', input);
  });
  it('updatePromotion', () => {
    promotions.updatePromotion('p1', { isActive: false });
    expect(api.put).toHaveBeenCalledWith('/promotions/p1', { isActive: false });
  });
  it('deletePromotion', () => {
    promotions.deletePromotion('p1');
    expect(api.delete).toHaveBeenCalledWith('/promotions/p1');
  });
});

describe('services api', () => {
  it('listServices', () => {
    services.listServices();
    expect(api.get).toHaveBeenCalledWith('/services');
  });
  it('createService', () => {
    const input = { name: 'Oil Change', description: '', durationMinutes: 30 };
    services.createService(input);
    expect(api.post).toHaveBeenCalledWith('/services', input);
  });
  it('updateService', () => {
    const input = { name: 'Oil Change', description: '', durationMinutes: 30 };
    services.updateService('s1', input);
    expect(api.put).toHaveBeenCalledWith('/services/s1', input);
  });
  it('deleteService', () => {
    services.deleteService('s1');
    expect(api.delete).toHaveBeenCalledWith('/services/s1');
  });
});

describe('tenant api', () => {
  it('getTenant', () => {
    tenant.getTenant();
    expect(api.get).toHaveBeenCalledWith('/tenants/me');
  });
  it('updateTenant', () => {
    const input = { name: 'Shop' };
    tenant.updateTenant(input);
    expect(api.put).toHaveBeenCalledWith('/tenants/me', input);
  });
});

describe('vehicles api', () => {
  it('listVehicles without a cursor', () => {
    vehicles.listVehicles();
    expect(api.get).toHaveBeenCalledWith('/vehicles?limit=25');
  });
  it('listVehicles with a cursor', () => {
    vehicles.listVehicles('cur1', 10);
    expect(api.get).toHaveBeenCalledWith('/vehicles?limit=10&cursor=cur1');
  });
  it('updateVehicle', () => {
    vehicles.updateVehicle('v1', { licensePlate: 'ABC123' });
    expect(api.put).toHaveBeenCalledWith('/vehicles/v1', { licensePlate: 'ABC123' });
  });
});
