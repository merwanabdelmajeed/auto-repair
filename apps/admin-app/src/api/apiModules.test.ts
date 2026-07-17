import { api } from './client';
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
import * as vehicles from './vehicles';

jest.mock('./client', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

describe('analytics api', () => {
  it('getAnalytics', () => {
    analytics.getAnalytics('2026-01-01', '2026-01-31');
    expect(api.get).toHaveBeenCalledWith('/analytics?startDate=2026-01-01&endDate=2026-01-31');
  });
});

describe('appointments api', () => {
  it('listAppointments with defaults', () => {
    appointments.listAppointments();
    expect(api.get).toHaveBeenCalledWith('/appointments?limit=25');
  });
  it('listAppointments with cursor and limit', () => {
    appointments.listAppointments('cur sor', 10);
    expect(api.get).toHaveBeenCalledWith('/appointments?limit=10&cursor=cur%20sor');
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
  it('listBlockedTimes URL-encodes locationId', () => {
    blockedTimes.listBlockedTimes('loc 1');
    expect(api.get).toHaveBeenCalledWith('/blocked-times?locationId=loc%201');
  });
  it('createBlockedTime', () => {
    const data = { label: 'Holiday', startDate: '2026-01-01', endDate: '2026-01-02' };
    blockedTimes.createBlockedTime('loc1', data);
    expect(api.post).toHaveBeenCalledWith('/blocked-times', { ...data, locationId: 'loc1' });
  });
  it('deleteBlockedTime', () => {
    blockedTimes.deleteBlockedTime('bt1');
    expect(api.delete).toHaveBeenCalledWith('/blocked-times/bt1');
  });
});

describe('campaigns api', () => {
  it('listCampaigns', () => {
    campaigns.listCampaigns();
    expect(api.get).toHaveBeenCalledWith('/campaigns');
  });
  it('createCampaign', () => {
    const data = { name: 'Promo', subject: 'Hi', body: 'Body', targetAudience: 'all' as const };
    campaigns.createCampaign(data);
    expect(api.post).toHaveBeenCalledWith('/campaigns', data);
  });
  it('sendCampaign', () => {
    campaigns.sendCampaign('c1');
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/send', {});
  });
});

describe('capacity api', () => {
  it('getCapacity URL-encodes locationId', () => {
    capacity.getCapacity('loc 1');
    expect(api.get).toHaveBeenCalledWith('/capacity?locationId=loc%201');
  });
  it('updateCapacity', () => {
    capacity.updateCapacity('loc1', { slotDurationMinutes: 30 });
    expect(api.put).toHaveBeenCalledWith('/capacity', { slotDurationMinutes: 30, locationId: 'loc1' });
  });
});

describe('customers api', () => {
  it('listCustomers with defaults', () => {
    customers.listCustomers();
    expect(api.get).toHaveBeenCalledWith('/customers?limit=25');
  });
  it('listCustomers with cursor and limit', () => {
    customers.listCustomers('cur sor', 5);
    expect(api.get).toHaveBeenCalledWith('/customers?limit=5&cursor=cur%20sor');
  });
});

describe('dashboard api', () => {
  it('getDashboardSummary sends a localDate query param', () => {
    dashboard.getDashboardSummary();
    expect(api.get).toHaveBeenCalledWith(expect.stringMatching(/^\/dashboard\/summary\?localDate=\d{4}-\d{2}-\d{2}$/));
  });
});

describe('locations api', () => {
  it('listLocations', () => {
    locations.listLocations();
    expect(api.get).toHaveBeenCalledWith('/locations');
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
  it('registerPushToken', () => {
    notifications.registerPushToken('expo-tok');
    expect(api.put).toHaveBeenCalledWith('/users/push-token', { token: 'expo-tok' });
  });
});

describe('promotions api', () => {
  it('listPromotions', () => {
    promotions.listPromotions();
    expect(api.get).toHaveBeenCalledWith('/promotions');
  });
  it('createPromotion', () => {
    const data = { code: 'SAVE10', description: '10% off', type: 'percent' as const, value: 10 };
    promotions.createPromotion(data);
    expect(api.post).toHaveBeenCalledWith('/promotions', data);
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
    const data = { name: 'Oil Change', description: 'Basic' };
    services.createService(data);
    expect(api.post).toHaveBeenCalledWith('/services', data);
  });
  it('updateService', () => {
    const data = { name: 'Oil Change', description: 'Basic', price: 45 };
    services.updateService('s1', data);
    expect(api.put).toHaveBeenCalledWith('/services/s1', data);
  });
  it('deleteService', () => {
    services.deleteService('s1');
    expect(api.delete).toHaveBeenCalledWith('/services/s1');
  });
});

describe('vehicles api', () => {
  it('listVehicles with defaults', () => {
    vehicles.listVehicles();
    expect(api.get).toHaveBeenCalledWith('/vehicles?limit=25');
  });
  it('listVehicles with cursor and limit', () => {
    vehicles.listVehicles('cur sor', 5);
    expect(api.get).toHaveBeenCalledWith('/vehicles?limit=5&cursor=cur%20sor');
  });
  it('updateVehicle', () => {
    vehicles.updateVehicle('v1', { licensePlate: 'ABC123' });
    expect(api.put).toHaveBeenCalledWith('/vehicles/v1', { licensePlate: 'ABC123' });
  });
});
