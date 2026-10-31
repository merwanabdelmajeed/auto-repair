export type AuthStackParamList = {
  Login: undefined;
};

export type AdminDrawerParamList = {
  Dashboard: undefined;
  Bookings: { appointmentId?: string } | undefined;
  // open: also open that customer's details (from an appointment's detail sheet).
  Customers: { customerId?: string; open?: boolean } | undefined;
  Vehicles: { customerId?: string } | undefined;
  Services: undefined;
  Capacity: undefined;
  BlockedTimes: undefined;
  Promotions: undefined;
  Statistics: undefined;
  Settings: undefined;
  Notifications: undefined;
};
