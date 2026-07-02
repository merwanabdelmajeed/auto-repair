import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, Alert, ActivityIndicator, FlatList, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listAppointments, createAppointment, cancelAppointment, type Appointment } from '../api/appointments';
import { validatePromoCode, type PromoValidation } from '../api/promotions';
import { listServices, type Service } from '../api/services';
import { listVehicles, type Vehicle } from '../api/vehicles';
import { getAvailability, type AvailabilityResult, type TimeSlot } from '../api/availability';

type BookingStep = 'service' | 'datetime' | 'vehicle' | 'confirm';

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', text: '#D97706' },
  confirmed: { bg: 'rgba(59,130,246,0.12)', text: '#2563EB' },
  'in-progress': { bg: 'rgba(139,92,246,0.12)', text: '#7C3AED' },
  completed: { bg: 'rgba(34,197,94,0.12)', text: '#16A34A' },
  cancelled: { bg: 'rgba(148,163,184,0.12)', text: '#64748B' },
};

const POPULAR_KEYWORDS = [
  'oil change', 'oil', 'tire rotation', 'tire', 'tyre',
  'brake', 'battery', 'ac service', 'air condition', 'a/c', 'ac',
  'alignment', 'wheel', 'filter', 'transmission', 'coolant', 'flush',
  'inspection', 'tune up', 'tune', 'spark', 'engine',
  'wiper', 'belt', 'fluid', 'exhaust',
];

function sortByPopularity(svcs: import('../api/services').Service[]) {
  function rank(name: string): number {
    const lower = name.toLowerCase();
    for (let i = 0; i < POPULAR_KEYWORDS.length; i++) {
      if (lower.includes(POPULAR_KEYWORDS[i]!)) return i;
    }
    return POPULAR_KEYWORDS.length;
  }
  return [...svcs].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LOOKAHEAD_DAYS = 30;

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildDates(): string[] {
  const today = new Date();
  return Array.from({ length: LOOKAHEAD_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return localDateStr(d);
  });
}

function parseDateParts(dateStr: string): { dayName: string; day: number; month: string; isToday: boolean } {
  const d = new Date(dateStr + 'T12:00:00Z');
  const today = new Date();
  const isToday = dateStr === localDateStr(today);
  return { dayName: DAY_SHORT[d.getUTCDay()]!, day: d.getUTCDate(), month: MONTH_SHORT[d.getUTCMonth()]!, isToday };
}

function fmt12h(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function AppointmentsScreen() {
  const dates = buildDates();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [sortAsc, setSortAsc] = useState(true);

  // Booking flow
  const [showBooking, setShowBooking] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateStr(new Date()));
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoData, setPromoData] = useState<PromoValidation | null>(null);
  const [promoError, setPromoError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);

  const dateListRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAppointments();
      setAppointments(data);
    } catch {
      Alert.alert('Error', 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function fetchAvailability(date: string) {
    setAvailabilityLoading(true);
    setSelectedTime('');
    setAvailability(null);
    try {
      const result = await getAvailability(date);
      setAvailability(result);
    } catch {
      setAvailability(null);
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function openBooking() {
    setBookingStep('service');
    setSelectedService(null);
    setSelectedVehicle(null);
    setSelectedDate(localDateStr(new Date()));
    setSelectedTime('');
    setAvailability(null);
    setNotes('');
    setPromoCode('');
    setPromoData(null);
    setPromoError('');
    setBookingError('');
    setShowBooking(true);
    const [svcs, vehs] = await Promise.all([listServices(), listVehicles()]);
    setServices(sortByPopularity(svcs.filter(s => s.isActive)));
    setVehicles(vehs);
  }

  async function handleDateSelect(date: string) {
    setSelectedDate(date);
    await fetchAvailability(date);
  }

  function enterDatetimeStep() {
    setBookingStep('datetime');
    void fetchAvailability(selectedDate);
  }

  function nextStep() {
    if (bookingStep === 'service') {
      if (!selectedService) { setBookingError('Please select a service.'); return; }
      setBookingError('');
      enterDatetimeStep();
    } else if (bookingStep === 'datetime') {
      if (!selectedDate || !selectedTime) { setBookingError('Please select a date and time slot.'); return; }
      setBookingError('');
      setBookingStep('vehicle');
    } else if (bookingStep === 'vehicle') {
      if (!selectedVehicle) { setBookingError('Please select a vehicle.'); return; }
      setBookingError('');
      setBookingStep('confirm');
    }
  }

  function prevStep() {
    if (bookingStep === 'datetime') setBookingStep('service');
    else if (bookingStep === 'vehicle') setBookingStep('datetime');
    else if (bookingStep === 'confirm') setBookingStep('vehicle');
  }

  async function applyPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoValidating(true);
    setPromoError('');
    setPromoData(null);
    try {
      const result = await validatePromoCode(code);
      setPromoData(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid promo code';
      setPromoError(msg);
    } finally {
      setPromoValidating(false);
    }
  }

  async function submitBooking() {
    if (!selectedService || !selectedVehicle || !selectedDate || !selectedTime) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      const appt = await createAppointment({
        serviceId: selectedService.serviceId,
        vehicleId: selectedVehicle.vehicleId,
        scheduledAt: `${selectedDate}T${selectedTime}:00`,
        notes: notes.trim() || undefined,
        promoCode: promoData ? promoData.code : undefined,
      });
      setAppointments(prev => [appt, ...prev]);
      setShowBooking(false);
      Alert.alert('Booked!', "Your appointment has been submitted. We'll confirm shortly.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('not available') || msg.includes('409')) {
        setBookingError('That time slot was just taken. Please go back and pick another.');
      } else {
        setBookingError('Failed to book appointment. Please try again.');
      }
    } finally {
      setBookingLoading(false);
    }
  }

  function confirmCancel(appt: Appointment) {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Appointment', style: 'destructive',
        onPress: async () => {
          try {
            await cancelAppointment(appt.appointmentId);
            setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, status: 'cancelled' } : a));
            setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, status: 'cancelled' } : prev);
          } catch {
            Alert.alert('Error', 'Failed to cancel appointment.');
          }
        },
      },
    ]);
  }

  const upcoming = appointments.filter(a => ['pending', 'confirmed', 'in-progress'].includes(a.status));
  const past = appointments.filter(a => ['completed', 'cancelled'].includes(a.status));
  const baseShown = activeTab === 'upcoming' ? upcoming : past;
  const shown = baseShown.slice().sort((a, b) =>
    sortAsc
      ? a.scheduledAt.localeCompare(b.scheduledAt)
      : b.scheduledAt.localeCompare(a.scheduledAt)
  );

  const STEPS: BookingStep[] = ['service', 'datetime', 'vehicle', 'confirm'];
  const stepIndex = STEPS.indexOf(bookingStep);

  function renderDateItem({ item: date }: { item: string }) {
    const { dayName, day, month, isToday } = parseDateParts(date);
    const isSelected = date === selectedDate;
    return (
      <TouchableOpacity
        onPress={() => void handleDateSelect(date)}
        style={[styles.dateChip, isSelected && styles.dateChipSelected]}
        activeOpacity={0.75}
      >
        <Text style={[styles.dateDayName, isSelected && styles.dateDayNameSelected]}>
          {isToday ? 'Today' : dayName}
        </Text>
        <Text style={[styles.dateNumber, isSelected && styles.dateNumberSelected]}>{day}</Text>
        <Text style={[styles.dateMonth, isSelected && styles.dateMonthSelected]}>{month}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <Layout>
      <View style={styles.tabBar}>
        <View style={styles.tabs}>
          {(['upcoming', 'past'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={() => setSortAsc(v => !v)} style={styles.sortBtn} activeOpacity={0.7}>
          <Ionicons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={13} color={colors.primary} />
          <Text style={styles.sortBtnText}>Date</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {shown.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={52} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{activeTab === 'upcoming' ? 'No Upcoming Appointments' : 'No Past Appointments'}</Text>
              <Text style={styles.emptyDesc}>
                {activeTab === 'upcoming' ? 'Book your first appointment to get started.' : 'Completed and cancelled appointments will appear here.'}
              </Text>
              {activeTab === 'upcoming' && (
                <TouchableOpacity style={styles.bookBtn} onPress={() => void openBooking()} activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                  <Text style={styles.bookBtnText}>Book an Appointment</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            shown.map(appt => {
              const sc = STATUS_COLOR[appt.status] ?? STATUS_COLOR.pending;
              return (
                <TouchableOpacity key={appt.appointmentId} style={styles.card} onPress={() => setDetailAppt(appt)} activeOpacity={0.85}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardService}>{appt.serviceName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc!.bg }]}>
                      <Text style={[styles.statusText, { color: sc!.text }]}>{appt.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardVehicle}>{appt.vehicleSummary}</Text>
                  <Text style={styles.cardDate}>{fmtDate(appt.scheduledAt)}</Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.cardPriceGroup}>
                      {appt.promoCode && (
                        <View style={styles.promoTag}>
                          <Text style={styles.promoTagText}>{appt.promoCode}</Text>
                        </View>
                      )}
                    </View>
                    {(appt.status === 'pending' || appt.status === 'confirmed') && (
                      <TouchableOpacity onPress={() => confirmCancel(appt)} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {!loading && (
        <TouchableOpacity style={styles.fab} onPress={() => void openBooking()} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

      {/* Detail Modal */}
      <Modal visible={!!detailAppt} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.detailSheet]}>
            {detailAppt && (() => {
              const sc = STATUS_COLOR[detailAppt.status] ?? STATUS_COLOR.pending;
              const detailRows = [
                { label: 'Vehicle', value: detailAppt.vehicleSummary },
                { label: 'Date & Time', value: fmtDate(detailAppt.scheduledAt) },
                ...(detailAppt.notes ? [{ label: 'Notes', value: detailAppt.notes }] : []),
                ...(detailAppt.promoCode ? [{ label: 'Promo Code', value: detailAppt.promoCode }] : []),
                { label: 'Booked On', value: fmtDate(detailAppt.createdAt) },
              ];
              return (
                <>
                  <View style={styles.detailHeader}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={styles.detailService} numberOfLines={2}>{detailAppt.serviceName}</Text>
                      <View style={[styles.detailBadge, { backgroundColor: sc!.bg }]}>
                        <Text style={[styles.detailBadgeText, { color: sc!.text }]}>
                          {detailAppt.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setDetailAppt(null)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={styles.detailScroll}>
                    {detailRows.map((row, i) => (
                      <View key={row.label} style={[styles.detailRow, i === detailRows.length - 1 && styles.detailRowLast]}>
                        <Text style={styles.detailLabel}>{row.label}</Text>
                        <Text style={styles.detailValue}>{row.value}</Text>
                      </View>
                    ))}
                  </ScrollView>

                  {(detailAppt.status === 'pending' || detailAppt.status === 'confirmed') && (
                    <TouchableOpacity
                      style={styles.detailCancelBtn}
                      onPress={() => confirmCancel(detailAppt)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                      <Text style={styles.detailCancelText}>Cancel Appointment</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Booking Modal */}
      <Modal visible={showBooking} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={prevStep} disabled={bookingStep === 'service'} style={{ opacity: bookingStep === 'service' ? 0 : 1 }}>
                <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {bookingStep === 'service' ? 'Choose Service'
                  : bookingStep === 'datetime' ? 'Choose Date & Time'
                  : bookingStep === 'vehicle' ? 'Choose Vehicle'
                  : 'Confirm Booking'}
              </Text>
              <TouchableOpacity onPress={() => setShowBooking(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.progress}>
              {STEPS.map((s, i) => (
                <View key={s} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
              ))}
            </View>

            {bookingError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{bookingError}</Text>
              </View>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              {/* Step 1: Service */}
              {bookingStep === 'service' && (
                services.length === 0 ? (
                  <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
                ) : services.map(svc => (
                  <TouchableOpacity key={svc.serviceId} onPress={() => setSelectedService(svc)} style={[styles.optionRow, selectedService?.serviceId === svc.serviceId && styles.optionRowSelected]}>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionName}>{svc.name}</Text>
                      <Text style={styles.optionSub}>{svc.durationMinutes} min</Text>
                      {svc.description ? <Text style={styles.optionDesc}>{svc.description}</Text> : null}
                    </View>
                    {selectedService?.serviceId === svc.serviceId && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}

              {/* Step 2: Date & Time Slot Picker */}
              {bookingStep === 'datetime' && (
                <View style={{ paddingBottom: spacing.md }}>
                  {/* Date strip */}
                  <FlatList
                    ref={dateListRef}
                    data={dates}
                    horizontal
                    keyExtractor={d => d}
                    renderItem={renderDateItem}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: spacing.sm, paddingHorizontal: 2 }}
                    style={{ marginBottom: spacing.md }}
                  />

                  {/* Slots */}
                  {availabilityLoading ? (
                    <View style={[styles.center, { paddingVertical: spacing.xl }]}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={[styles.slotClosedText, { marginTop: spacing.sm }]}>Loading slots…</Text>
                    </View>
                  ) : !availability ? (
                    <View style={styles.slotClosedBox}>
                      <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                      <Text style={styles.slotClosedText}>Select a date above</Text>
                    </View>
                  ) : !availability.isOpen ? (
                    <View style={styles.slotClosedBox}>
                      <Ionicons name="moon-outline" size={32} color={colors.textMuted} />
                      <Text style={styles.slotClosedText}>
                        {availability.blockedReason ? `Closed — ${availability.blockedReason}` : 'Shop is closed on this day'}
                      </Text>
                    </View>
                  ) : availability.slots.length === 0 ? (
                    <View style={styles.slotClosedBox}>
                      <Ionicons name="time-outline" size={32} color={colors.textMuted} />
                      <Text style={styles.slotClosedText}>No available slots on this day</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.slotsLabel}>Available Times</Text>
                      <View style={styles.slotsGrid}>
                        {availability.slots.map((slot: TimeSlot) => {
                          const isSelected = slot.time === selectedTime;
                          return (
                            <TouchableOpacity
                              key={slot.time}
                              onPress={() => slot.available && setSelectedTime(slot.time)}
                              disabled={!slot.available}
                              style={[
                                styles.slotChip,
                                isSelected && styles.slotChipSelected,
                                !slot.available && styles.slotChipUnavailable,
                              ]}
                              activeOpacity={0.75}
                            >
                              <Text style={[
                                styles.slotChipText,
                                isSelected && styles.slotChipTextSelected,
                                !slot.available && styles.slotChipTextUnavailable,
                              ]}>
                                {fmt12h(slot.time)}
                              </Text>
                              {!slot.available && <Text style={styles.slotFullText}>Full</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Step 3: Vehicle */}
              {bookingStep === 'vehicle' && (
                vehicles.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="car-outline" size={40} color={colors.textMuted} />
                    <Text style={[styles.emptyTitle, { fontSize: 15, marginTop: spacing.sm }]}>No vehicles added</Text>
                    <Text style={[styles.emptyDesc, { fontSize: 13 }]}>Add a vehicle in the Vehicles section first.</Text>
                  </View>
                ) : vehicles.map(v => (
                  <TouchableOpacity key={v.vehicleId} onPress={() => setSelectedVehicle(v)} style={[styles.optionRow, selectedVehicle?.vehicleId === v.vehicleId && styles.optionRowSelected]}>
                    <View style={styles.optionInfo}>
                      <Text style={styles.optionName}>{v.year} {v.make} {v.model}</Text>
                      <Text style={styles.optionSub}>{v.licensePlate} · {v.color}</Text>
                    </View>
                    {selectedVehicle?.vehicleId === v.vehicleId && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))
              )}

              {/* Step 4: Confirm */}
              {bookingStep === 'confirm' && selectedService && selectedVehicle && (
                <View style={{ paddingBottom: spacing.md }}>
                  {[
                    { label: 'Service', value: selectedService.name },
                    { label: 'Duration', value: `${selectedService.durationMinutes} min` },
                    { label: 'Vehicle', value: `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}` },
                    { label: 'Date', value: selectedDate },
                    { label: 'Time', value: fmt12h(selectedTime) },
                  ].map(r => (
                    <View key={r.label} style={styles.confirmRow}>
                      <Text style={styles.confirmLabel}>{r.label}</Text>
                      <Text style={styles.confirmValue}>{r.value}</Text>
                    </View>
                  ))}

                  {/* Promo code input */}
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={styles.fieldLabel}>Promo Code (optional)</Text>
                    <View style={styles.promoRow}>
                      <TextInput
                        style={styles.promoInput}
                        value={promoCode}
                        onChangeText={v => { setPromoCode(v); setPromoData(null); setPromoError(''); }}
                        placeholder="Enter code"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="characters"
                        editable={!promoData}
                      />
                      <TouchableOpacity
                        style={[styles.promoBtn, (promoValidating || !!promoData) && styles.promoBtnDisabled]}
                        onPress={() => void applyPromo()}
                        disabled={promoValidating || !!promoData || !promoCode.trim()}
                        activeOpacity={0.8}
                      >
                        {promoValidating ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={styles.promoBtnText}>{promoData ? 'Applied' : 'Apply'}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    {promoData && (
                      <View style={styles.promoSuccess}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={styles.promoSuccessText}>{promoData.description}</Text>
                        <TouchableOpacity onPress={() => { setPromoData(null); setPromoCode(''); }}>
                          <Text style={styles.promoRemoveText}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    {promoError ? <Text style={styles.promoErrorText}>{promoError}</Text> : null}
                  </View>

                  <View style={{ marginTop: spacing.md }}>
                    <Text style={styles.fieldLabel}>Notes (optional)</Text>
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="Any special requests or details…"
                      placeholderTextColor={colors.textMuted}
                      multiline
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, (bookingLoading || (bookingStep === 'vehicle' && vehicles.length === 0)) && styles.saveBtnDisabled]}
              onPress={() => bookingStep === 'confirm' ? void submitBooking() : nextStep()}
              disabled={bookingLoading || (bookingStep === 'vehicle' && vehicles.length === 0)}
              activeOpacity={0.85}
            >
              {bookingLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.saveBtnText}>{bookingStep === 'confirm' ? 'Confirm Booking' : 'Next'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },

  tabBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginVertical: spacing.md, gap: spacing.sm },
  tabs: { flex: 1, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: 4, ...shadows.sm },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.md },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, ...shadows.sm },
  sortBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg, ...shadows.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 },
  bookBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: 14, paddingHorizontal: spacing.xl, gap: spacing.sm },
  bookBtnText: { ...typography.h4, color: colors.white },

  card: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardService: { ...typography.h4, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardVehicle: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 2 },
  cardDate: { ...typography.small, color: colors.textMuted, marginBottom: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelBtn: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  cancelBtnText: { fontSize: 12, color: colors.error, fontWeight: '600' },

  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', ...shadows.lg },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, color: colors.textPrimary, flex: 1, textAlign: 'center' },

  progress: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: spacing.md },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  progressDotActive: { backgroundColor: colors.primary },

  errorBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm },
  errorText: { ...typography.bodySmall, color: colors.error },

  optionRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, backgroundColor: colors.background },
  optionRowSelected: { borderColor: colors.primary, backgroundColor: 'rgba(15,32,68,0.04)' },
  optionInfo: { flex: 1 },
  optionName: { ...typography.h4, color: colors.textPrimary, marginBottom: 2 },
  optionSub: { ...typography.bodySmall, color: colors.secondary, fontWeight: '600' },
  optionDesc: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  // Date strip
  dateChip: { alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, paddingVertical: 10, paddingHorizontal: 12, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, minWidth: 58 },
  dateChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateDayName: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  dateDayNameSelected: { color: 'rgba(255,255,255,0.75)' },
  dateNumber: { ...typography.h3, color: colors.textPrimary, lineHeight: 26 },
  dateNumberSelected: { color: colors.white },
  dateMonth: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  dateMonthSelected: { color: 'rgba(255,255,255,0.65)' },

  // Slot grid
  slotsLabel: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.sm },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slotChip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'rgba(15,32,68,0.04)', alignItems: 'center', minWidth: '29%' },
  slotChipSelected: { backgroundColor: colors.primary },
  slotChipUnavailable: { borderColor: colors.border, backgroundColor: colors.background, opacity: 0.5 },
  slotChipText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  slotChipTextSelected: { color: colors.white },
  slotChipTextUnavailable: { color: colors.textMuted, fontWeight: '400' },
  slotFullText: { fontSize: 10, color: colors.textMuted, marginTop: 1 },

  slotClosedBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  slotClosedText: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center' },

  fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 },
  notesInput: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 12, height: 80, textAlignVertical: 'top', ...typography.body, color: colors.textPrimary, backgroundColor: colors.background },

  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  confirmLabel: { ...typography.bodySmall, color: colors.textSecondary },
  confirmValue: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: spacing.md },

  promoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  promoInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 10, ...typography.body, color: colors.textPrimary, backgroundColor: colors.background },
  promoBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center', minWidth: 72 },
  promoBtnDisabled: { backgroundColor: colors.success },
  promoBtnText: { ...typography.bodySmall, color: colors.white, fontWeight: '700' },
  promoSuccess: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  promoSuccessText: { ...typography.small, color: colors.success, flex: 1 },
  promoRemoveText: { ...typography.small, color: colors.error, fontWeight: '600' },
  promoErrorText: { ...typography.small, color: colors.error, marginTop: spacing.xs },

  cardPriceGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  promoTag: { backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: borderRadius.xs, paddingHorizontal: 6, paddingVertical: 2 },
  promoTagText: { fontSize: 10, color: colors.success, fontWeight: '700' },

  saveBtn: { backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.md, ...shadows.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.primary },

  detailSheet:      { maxHeight: '60%' },
  detailHeader:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  detailService:    { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  detailBadge:      { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  detailBadgeText:  { fontSize: 11, fontWeight: '700' as const, textTransform: 'capitalize' as const },
  detailScroll:     { flexGrow: 0 },
  detailRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  detailRowLast:    { borderBottomWidth: 0 },
  detailLabel:      { ...typography.bodySmall, color: colors.textSecondary, width: 100 },
  detailValue:      { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600', flex: 1, textAlign: 'right' },
  detailCancelBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.lg, paddingVertical: 14, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.error, backgroundColor: 'rgba(239,68,68,0.05)' },
  detailCancelText: { ...typography.h4, color: colors.error },
});
