import { api } from './client';
import * as appointments from './appointments';
import * as availability from './availability';
import * as capacity from './capacity';
import * as locations from './locations';
import * as notifications from './notifications';
import * as promotions from './promotions';
import * as services from './services';
import * as vehicles from './vehicles';

jest.mock('./client', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

describe('appointments api', () => {
  it('listAppointments', () => {
    appointments.listAppointments();
    expect(api.get).toHaveBeenCalledWith('/appointments');
  });
  it('createAppointment', () => {
    const input = { locationId: 'loc1', vehicleId: 'v1', serviceId: 's1', scheduledAt: '2026-01-01T10:00:00.000Z' };
    appointments.createAppointment(input);
    expect(api.post).toHaveBeenCalledWith('/appointments', input);
  });
  it('cancelAppointment', () => {
    appointments.cancelAppointment('a1');
    expect(api.patch).toHaveBeenCalledWith('/appointments/a1/status', { status: 'cancelled' });
  });
});

describe('availability api', () => {
  it('getAvailability URL-encodes the locationId', () => {
    availability.getAvailability('2026-01-01', 'loc 1');
    expect(api.get).toHaveBeenCalledWith('/availability?date=2026-01-01&locationId=loc%201');
  });
});

describe('capacity api', () => {
  it('getCapacity', () => {
    capacity.getCapacity();
    expect(api.get).toHaveBeenCalledWith('/capacity');
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
  it('validatePromoCode URL-encodes the code', () => {
    promotions.validatePromoCode('save 10');
    expect(api.get).toHaveBeenCalledWith('/promotions/validate?code=save%2010');
  });
});

describe('services api', () => {
  it('listServices', () => {
    services.listServices();
    expect(api.get).toHaveBeenCalledWith('/services');
  });
});

describe('vehicles api', () => {
  it('listVehicles', () => {
    vehicles.listVehicles();
    expect(api.get).toHaveBeenCalledWith('/vehicles');
  });
  it('createVehicle', () => {
    const input = { make: 'Honda', model: 'Civic', year: 2020, color: 'blue' };
    vehicles.createVehicle(input);
    expect(api.post).toHaveBeenCalledWith('/vehicles', input);
  });
  it('deleteVehicle', () => {
    vehicles.deleteVehicle('v1');
    expect(api.delete).toHaveBeenCalledWith('/vehicles/v1');
  });
  it('lookupPlate URL-encodes plate and state', () => {
    vehicles.lookupPlate('ABC 123', 'ca');
    expect(api.get).toHaveBeenCalledWith('/vehicles/plate?plate=ABC%20123&state=ca');
  });
});
