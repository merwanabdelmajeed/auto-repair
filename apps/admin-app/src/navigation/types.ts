export type AuthStackParamList = {
  Login: undefined;
};

export type AdminDrawerParamList = {
  Dashboard: undefined;
  Bookings: undefined;
  Customers: { customerId?: string } | undefined;
  Vehicles: { customerId?: string } | undefined;
  Services: undefined;
  Capacity: undefined;
  BlockedTimes: undefined;
  Promotions: undefined;
  Statistics: undefined;
  Settings: undefined;
};
