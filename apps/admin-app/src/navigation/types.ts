export type AuthStackParamList = {
  Login: undefined;
};

export type AdminDrawerParamList = {
  Dashboard: undefined;
  Bookings: { appointmentId?: string } | undefined;
  Customers: { customerId?: string } | undefined;
  Vehicles: { customerId?: string } | undefined;
  Services: undefined;
  Capacity: undefined;
  BlockedTimes: undefined;
  Promotions: undefined;
  Statistics: undefined;
  Settings: undefined;
  Notifications: undefined;
};
