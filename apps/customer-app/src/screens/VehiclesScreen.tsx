import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listVehicles, createVehicle, deleteVehicle, lookupPlate, type Vehicle } from '../api/vehicles';
import { listAppointments, type Appointment } from '../api/appointments';

const EMPTY_FORM = { year: '', make: '', model: '', trim: '', color: '', licensePlate: '', vin: '' };
const CUR_YEAR = new Date().getFullYear();

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
] as [string, string][];

let makesCache: string[] | null = null;
const modelsCache = new Map<string, string[]>(); // key: "make_lower|year"
const trimsCache  = new Map<string, string[]>(); // key: "make_lower|year|model_lower"

function filterSuggestions(list: string[], query: string, max = 7): string[] {
  const q = query.toLowerCase();
  const prefix = list.filter(s => s.toLowerCase().startsWith(q));
  const rest   = list.filter(s => !s.toLowerCase().startsWith(q) && s.toLowerCase().includes(q));
  return [...prefix, ...rest].slice(0, max);
}

async function fetchMakes(): Promise<string[]> {
  if (makesCache) return makesCache;
  try {
    const res = await fetch('https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car?format=json');
    if (!res.ok) return [];
    const data = await res.json() as { Results?: { MakeName: string }[] };
    makesCache = (data.Results ?? []).map(r => r.MakeName).sort();
    return makesCache;
  } catch { return []; }
}

async function fetchModels(make: string, year: string): Promise<string[]> {
  if (!make || year.length !== 4) return [];
  const key = `${make.toLowerCase()}|${year}`;
  if (modelsCache.has(key)) return modelsCache.get(key)!;
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`,
    );
    if (!res.ok) return [];
    const data = await res.json() as { Results?: { Model_Name: string }[] };
    const models = [...new Set((data.Results ?? []).map(r => r.Model_Name))].sort();
    modelsCache.set(key, models);
    return models;
  } catch { return []; }
}

// NHTSA stores trim variants as separate model entries: "GLS", "GLS 450", "GLS 580".
// fetchTrims fetches the year+make model list and extracts entries that start with "{model} ",
// returning the suffix as the trim name. e.g. model="GLS" → ["450", "580"].
async function fetchTrims(make: string, model: string, year: string): Promise<string[]> {
  if (!make || !model || year.length !== 4) return [];
  const key = `${make.toLowerCase()}|${year}|${model.toLowerCase()}`;
  if (trimsCache.has(key)) return trimsCache.get(key)!;
  const allModels = await fetchModels(make, year);
  const prefix = model.toLowerCase() + ' ';
  const trims = allModels
    .filter(m => m.toLowerCase().startsWith(prefix))
    .map(m => m.slice(model.length).trim())
    .filter(t => t.length > 0)
    .sort();
  trimsCache.set(key, trims);
  return trims;
}

async function lookupVin(vin: string): Promise<{ make: string; model: string; year: string; trim?: string } | null> {
  try {
    const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`);
    if (!res.ok) return null;
    const data = await res.json() as { Results?: { Make?: string; Model?: string; ModelYear?: string; Trim?: string }[] };
    const r = data.Results?.[0];
    if (!r?.Make || !r?.Model || !r?.ModelYear) return null;
    return { make: r.Make, model: r.Model, year: r.ModelYear, trim: r.Trim || undefined };
  } catch { return null; }
}

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

  const [makeSuggestions,  setMakeSuggestions]  = useState<string[]>([]);
  const [modelSuggestions, setModelSuggestions] = useState<string[]>([]);
  const [trimSuggestions,  setTrimSuggestions]  = useState<string[]>([]);
  const [trimDropdownOpen, setTrimDropdownOpen] = useState(false);
  const [trimsFetched,     setTrimsFetched]     = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [trimsLoading,  setTrimsLoading]  = useState(false);
  const [vinLooking,    setVinLooking]    = useState(false);
  const [searchMode,    setSearchMode]    = useState<'plate' | 'vin'>('plate');
  const [plateState,    setPlateState]    = useState('');
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const [plateLooking,  setPlateLooking]  = useState(false);
  const [plateError,    setPlateError]    = useState('');

  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory]               = useState<Appointment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const makeBlurTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelBlurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setVehicles(await listVehicles());
    } catch {
      Alert.alert('Error', 'Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (showModal) void fetchMakes(); }, [showModal]);

  // ── Year ──────────────────────────────────────────────────────────────────
  function handleYearChange(text: string) {
    setForm(prev => ({ ...prev, year: text, model: '', trim: '' }));
    setModelSuggestions([]);
    setTrimSuggestions([]);
    setTrimsFetched(false);
    if (text.length === 4 && form.make) {
      void (async () => {
        setModelsLoading(true);
        await fetchModels(form.make, text);
        setModelsLoading(false);
      })();
    }
  }

  // ── Make ──────────────────────────────────────────────────────────────────
  async function handleMakeChange(text: string) {
    setForm(prev => ({ ...prev, make: text, model: '', trim: '' }));
    setModelSuggestions([]);
    setTrimSuggestions([]);
    setTrimsFetched(false);
    if (!text) { setMakeSuggestions([]); return; }
    setMakeSuggestions(filterSuggestions(await fetchMakes(), text));
  }

  function selectMake(make: string) {
    if (makeBlurTimer.current) clearTimeout(makeBlurTimer.current);
    const year = form.year;
    setForm(prev => ({ ...prev, make, model: '', trim: '' }));
    setMakeSuggestions([]);
    setModelSuggestions([]);
    setTrimSuggestions([]);
    setTrimDropdownOpen(false);
    setTrimsFetched(false);
    if (year.length === 4) {
      void (async () => {
        setModelsLoading(true);
        await fetchModels(make, year);
        setModelsLoading(false);
      })();
    }
  }

  // ── Model ─────────────────────────────────────────────────────────────────
  async function handleModelChange(text: string) {
    setForm(prev => ({ ...prev, model: text, trim: '' }));
    setTrimSuggestions([]);
    setTrimDropdownOpen(false);
    setTrimsFetched(false);
    if (!text || !form.make || form.year.length !== 4) { setModelSuggestions([]); return; }
    setModelSuggestions(filterSuggestions(await fetchModels(form.make, form.year), text));
  }

  function selectModel(model: string) {
    if (modelBlurTimer.current) clearTimeout(modelBlurTimer.current);
    const make = form.make;
    const year = form.year;
    setForm(prev => ({ ...prev, model, trim: '' }));
    setModelSuggestions([]);
    setTrimSuggestions([]);
    setTrimDropdownOpen(false);
    setTrimsFetched(false);
    setTrimsLoading(true);
    void fetchTrims(make, model, year).then(trims => {
      setTrimSuggestions(trims);
      setTrimsFetched(true);
      setTrimsLoading(false);
    });
  }

  // ── Trim ──────────────────────────────────────────────────────────────────
  function toggleTrimDropdown() {
    if (!form.model) return;
    if (trimDropdownOpen) { setTrimDropdownOpen(false); return; }
    setTrimDropdownOpen(true);
    if (!trimsFetched) {
      setTrimsLoading(true);
      void fetchTrims(form.make, form.model, form.year).then(trims => {
        setTrimSuggestions(trims);
        setTrimsFetched(true);
        setTrimsLoading(false);
      });
    }
  }

  function selectTrim(trim: string) {
    setForm(prev => ({ ...prev, trim }));
    setTrimDropdownOpen(false);
  }

  // ── Search mode toggle ────────────────────────────────────────────────────
  function switchMode(mode: 'plate' | 'vin') {
    setSearchMode(mode);
    if (mode === 'plate') {
      setForm(prev => ({ ...prev, vin: '' }));
    } else {
      setForm(prev => ({ ...prev, licensePlate: '' }));
    }
  }

  // ── Plate lookup ──────────────────────────────────────────────────────────
  async function handlePlateLookup() {
    if (!form.licensePlate.trim() || !plateState) return;
    setPlateError('');
    setPlateLooking(true);
    try {
      const result = await lookupPlate(form.licensePlate.trim(), plateState);
      setForm(prev => ({
        ...prev,
        vin:   result.vin,
        make:  result.make,
        model: result.model,
        year:  result.year,
        trim:  result.trim ?? prev.trim,
      }));
      setMakeSuggestions([]);
      setModelSuggestions([]);
      setTrimDropdownOpen(false);
      setTrimsFetched(false);
      void fetchTrims(result.make, result.model, result.year).then(trims => {
        setTrimSuggestions(trims);
        setTrimsFetched(true);
      });
    } catch {
      setPlateError('Could not find vehicle for that plate and state. Check the plate and try again.');
    } finally {
      setPlateLooking(false);
    }
  }

  // ── VIN ───────────────────────────────────────────────────────────────────
  async function handleVinChange(vin: string) {
    setForm(prev => ({ ...prev, vin }));
    if (vin.replace(/\s/g, '').length === 17) {
      setVinLooking(true);
      const result = await lookupVin(vin.trim());
      setVinLooking(false);
      if (result) {
        setForm(prev => ({
          ...prev, vin,
          make: result.make, model: result.model, year: result.year,
          trim: result.trim ?? prev.trim,
        }));
        setMakeSuggestions([]);
        setModelSuggestions([]);
        setTrimDropdownOpen(false);
        setTrimsFetched(false);
        void fetchTrims(result.make, result.model, result.year).then(trims => {
          setTrimSuggestions(trims);
          setTrimsFetched(true);
        });
      }
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleAdd() {
    const year = parseInt(form.year, 10);
    if (!form.make.trim() || !form.model.trim() || !form.year.trim() || !form.color.trim()) {
      setFormError('Year, make, model, and color are required.');
      return;
    }
    if (isNaN(year) || year < 1900 || year > CUR_YEAR + 1) {
      setFormError('Please enter a valid year.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const created = await createVehicle({
        make:         form.make.trim(),
        model:        form.model.trim(),
        trim:         form.trim.trim() || undefined,
        year,
        licensePlate: form.licensePlate.trim().toUpperCase() || undefined,
        color:        form.color.trim(),
        vin:          form.vin.trim() || undefined,
      });
      setVehicles(prev => [created, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
    } catch {
      setFormError('Failed to add vehicle. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(vehicle: Vehicle) {
    Alert.alert(
      'Remove Vehicle',
      `Remove ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await deleteVehicle(vehicle.vehicleId);
              setVehicles(prev => prev.filter(v => v.vehicleId !== vehicle.vehicleId));
            } catch {
              Alert.alert('Error', 'Failed to remove vehicle.');
            }
          },
        },
      ],
    );
  }

  async function openHistory(vehicle: Vehicle) {
    setHistoryVehicle(vehicle);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const all = await listAppointments();
      setHistory(
        all
          .filter(a => a.vehicleId === vehicle.vehicleId)
          .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
      );
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError('');
    setMakeSuggestions([]);
    setModelSuggestions([]);
    setTrimSuggestions([]);
    setTrimDropdownOpen(false);
    setTrimsFetched(false);
    setTrimsLoading(false);
    setSearchMode('plate');
    setPlateState('');
    setStateDropdownOpen(false);
    setPlateError('');
    setShowModal(true);
  }

  // ── Suggestion list helper ─────────────────────────────────────────────────
  function SuggestionList({ items, onSelect, timer }: { items: string[]; onSelect: (v: string) => void; timer: React.MutableRefObject<ReturnType<typeof setTimeout> | null> }) {
    return (
      <View style={styles.suggestionList}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={item}
            style={[styles.suggestionItem, i === items.length - 1 && styles.suggestionItemLast]}
            onPress={() => { if (timer.current) clearTimeout(timer.current); onSelect(item); }}
            activeOpacity={0.7}
          >
            <Text style={styles.suggestionText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <Layout>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {vehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="car-outline" size={52} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>No Vehicles Added</Text>
              <Text style={styles.emptyDesc}>Add your vehicles to quickly book appointments and track service history.</Text>
              <TouchableOpacity style={styles.addBtn} onPress={openModal} activeOpacity={0.85}>
                <Ionicons name="add" size={22} color={colors.white} />
                <Text style={styles.addBtnText}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>My Vehicles ({vehicles.length})</Text>
              {vehicles.map(vehicle => (
                <TouchableOpacity key={vehicle.vehicleId} style={styles.vehicleCard} onPress={() => void openHistory(vehicle)} activeOpacity={0.85}>
                  <View style={styles.vehicleIconBox}>
                    <Ionicons name="car" size={28} color={colors.primary} />
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>
                      {vehicle.year} {vehicle.make} {vehicle.model}{vehicle.trim ? ' ' + vehicle.trim : ''}
                    </Text>
                    {vehicle.licensePlate ? <Text style={styles.vehiclePlate}>{vehicle.licensePlate}</Text> : null}
                    <Text style={styles.vehicleColor}>{vehicle.color}</Text>
                    {vehicle.vin ? <Text style={styles.vehicleVin}>VIN: {vehicle.vin}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(vehicle)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {!loading && (
        <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Vehicle</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {formError ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              ) : null}

              {/* Search mode toggle */}
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeBtn, searchMode === 'plate' && styles.modeBtnActive]}
                  onPress={() => switchMode('plate')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="card-outline" size={15} color={searchMode === 'plate' ? colors.primary : colors.textMuted} />
                  <Text style={[styles.modeBtnText, searchMode === 'plate' && styles.modeBtnTextActive]}>License Plate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, searchMode === 'vin' && styles.modeBtnActive]}
                  onPress={() => switchMode('vin')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="barcode-outline" size={15} color={searchMode === 'vin' ? colors.primary : colors.textMuted} />
                  <Text style={[styles.modeBtnText, searchMode === 'vin' && styles.modeBtnTextActive]}>VIN Number</Text>
                </TouchableOpacity>
              </View>

              {searchMode === 'plate' ? (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>License Plate</Text>
                  <View style={styles.plateRow}>
                    <TouchableOpacity
                      style={styles.stateBtn}
                      onPress={() => setStateDropdownOpen(prev => !prev)}
                      activeOpacity={0.75}
                    >
                      <Text style={plateState ? styles.stateBtnValue : styles.stateBtnPlaceholder}>
                        {plateState || 'State'}
                      </Text>
                      <Ionicons name={stateDropdownOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, styles.plateInput]}
                      value={form.licensePlate}
                      onChangeText={v => { setForm(prev => ({ ...prev, licensePlate: v })); setPlateError(''); }}
                      placeholder="e.g. ABC1234"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={[styles.lookupBtn, (!form.licensePlate.trim() || !plateState || plateLooking) && styles.lookupBtnDisabled]}
                      onPress={() => void handlePlateLookup()}
                      disabled={!form.licensePlate.trim() || !plateState || plateLooking}
                      activeOpacity={0.8}
                    >
                      {plateLooking
                        ? <ActivityIndicator size="small" color={colors.white} />
                        : <Ionicons name="search" size={18} color={colors.white} />}
                    </TouchableOpacity>
                  </View>
                  {stateDropdownOpen && (
                    <View style={styles.stateDropdown}>
                      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                        {US_STATES.map(([abbr, name]) => (
                          <TouchableOpacity
                            key={abbr}
                            style={[styles.stateItem, plateState === abbr && styles.stateItemActive]}
                            onPress={() => { setPlateState(abbr); setStateDropdownOpen(false); }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.stateItemText, plateState === abbr && styles.stateItemTextActive]}>
                              {name}
                            </Text>
                            <Text style={styles.stateItemAbbr}>{abbr}</Text>
                            {plateState === abbr && <Ionicons name="checkmark" size={16} color={colors.primary} style={{ marginLeft: 8 }} />}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {plateError ? <Text style={styles.plateError}>{plateError}</Text> : null}
                </View>
              ) : (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>VIN <Text style={styles.optional}>(auto-fills details)</Text></Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={[styles.input, styles.inputFlex]}
                      value={form.vin}
                      onChangeText={v => void handleVinChange(v)}
                      placeholder="17-character VIN"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      maxLength={17}
                    />
                    {vinLooking && <ActivityIndicator size="small" color={colors.primary} style={styles.rowSpinner} />}
                  </View>
                </View>
              )}

              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>vehicle details</Text>
                <View style={styles.orLine} />
              </View>

              {/* Year */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Year *</Text>
                <TextInput
                  style={styles.input}
                  value={form.year}
                  onChangeText={handleYearChange}
                  placeholder="e.g. 2021"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              </View>

              {/* Make */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Make *</Text>
                <TextInput
                  style={styles.input}
                  value={form.make}
                  onChangeText={v => void handleMakeChange(v)}
                  onFocus={() => { if (makeBlurTimer.current) clearTimeout(makeBlurTimer.current); if (form.make) void handleMakeChange(form.make); }}
                  onBlur={() => { makeBlurTimer.current = setTimeout(() => setMakeSuggestions([]), 150); }}
                  placeholder="e.g. Toyota"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
                {makeSuggestions.length > 0 && (
                  <SuggestionList items={makeSuggestions} onSelect={selectMake} timer={makeBlurTimer} />
                )}
              </View>

              {/* Model */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Model *</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    value={form.model}
                    onChangeText={v => void handleModelChange(v)}
                    onFocus={() => { if (modelBlurTimer.current) clearTimeout(modelBlurTimer.current); if (form.model && form.make && form.year.length === 4) void handleModelChange(form.model); }}
                    onBlur={() => { modelBlurTimer.current = setTimeout(() => setModelSuggestions([]), 150); }}
                    placeholder={!form.make || form.year.length !== 4 ? 'Enter year and make first' : 'e.g. Camry'}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    editable={!!form.make && form.year.length === 4}
                  />
                  {modelsLoading && <ActivityIndicator size="small" color={colors.primary} style={styles.rowSpinner} />}
                </View>
                {modelSuggestions.length > 0 && (
                  <SuggestionList items={modelSuggestions} onSelect={selectModel} timer={modelBlurTimer} />
                )}
              </View>

              {/* Trim — dropdown when NHTSA has data, text input as fallback */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Trim <Text style={styles.optional}>(optional)</Text></Text>
                {trimsFetched && trimSuggestions.length === 0 ? (
                  <TextInput
                    style={styles.input}
                    value={form.trim}
                    onChangeText={v => setForm(prev => ({ ...prev, trim: v }))}
                    placeholder="e.g. SE, Sport, AMG Line"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.input, styles.dropdownBtn, !form.model && styles.inputDisabled]}
                      onPress={toggleTrimDropdown}
                      activeOpacity={0.7}
                      disabled={!form.model}
                    >
                      <Text style={form.trim ? styles.dropdownValue : styles.dropdownPlaceholder} numberOfLines={1}>
                        {form.trim || (form.model ? 'Select trim (optional)' : 'Select a model first')}
                      </Text>
                      {trimsLoading
                        ? <ActivityIndicator size="small" color={colors.primary} />
                        : <Ionicons name={trimDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />}
                    </TouchableOpacity>
                    {trimDropdownOpen && !trimsLoading && trimSuggestions.length > 0 && (
                      <View style={styles.suggestionList}>
                        {form.trim ? (
                          <TouchableOpacity style={styles.suggestionItem} onPress={() => selectTrim('')} activeOpacity={0.7}>
                            <Text style={[styles.suggestionText, { color: colors.textMuted }]}>— None —</Text>
                          </TouchableOpacity>
                        ) : null}
                        {trimSuggestions.map((trim, i) => (
                          <TouchableOpacity
                            key={trim}
                            style={[styles.suggestionItem, i === trimSuggestions.length - 1 && !form.trim && styles.suggestionItemLast]}
                            onPress={() => selectTrim(trim)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.suggestionText, form.trim === trim && styles.suggestionTextSelected]}>{trim}</Text>
                            {form.trim === trim && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Color */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Color *</Text>
                <TextInput
                  style={styles.input}
                  value={form.color}
                  onChangeText={v => setForm(prev => ({ ...prev, color: v }))}
                  placeholder="e.g. Silver"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>

              {/* License Plate — only shown in VIN mode since plate mode captures it at the top */}
              {searchMode === 'vin' && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>License Plate <Text style={styles.optional}>(optional)</Text></Text>
                  <TextInput
                    style={styles.input}
                    value={form.licensePlate}
                    onChangeText={v => setForm(prev => ({ ...prev, licensePlate: v }))}
                    placeholder="e.g. ABC1234"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={() => void handleAdd()}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color={colors.primary} />
                  : <Text style={styles.saveBtnText}>Add Vehicle</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={!!historyVehicle} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.historySheet]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={styles.modalTitle}>Service History</Text>
                {historyVehicle && (
                  <Text style={styles.historySubtitle} numberOfLines={1}>
                    {historyVehicle.year} {historyVehicle.make} {historyVehicle.model}
                    {historyVehicle.trim ? ' ' + historyVehicle.trim : ''}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setHistoryVehicle(null)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {historyLoading ? (
              <View style={styles.historyCenter}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : history.length === 0 ? (
              <View style={styles.historyCenter}>
                <Ionicons name="receipt-outline" size={44} color={colors.textMuted} />
                <Text style={styles.historyEmptyTitle}>No Service Records</Text>
                <Text style={styles.historyEmptyDesc}>No appointments have been booked for this vehicle yet.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {history.map((appt, i) => {
                  const date = new Date(appt.scheduledAt);
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                  const statusColors: Record<string, string> = {
                    pending: '#F59E0B', confirmed: '#3B82F6',
                    'in-progress': '#8B5CF6', completed: '#10B981', cancelled: '#6B7280',
                  };
                  const badgeColor = statusColors[appt.status] ?? '#6B7280';
                  return (
                    <View key={appt.appointmentId} style={[styles.historyCard, i === history.length - 1 && styles.historyCardLast]}>
                      <View style={styles.historyCardTop}>
                        <Text style={styles.historyService} numberOfLines={1}>{appt.serviceName}</Text>
                        <View style={[styles.historyBadge, { backgroundColor: badgeColor + '22', borderColor: badgeColor + '55' }]}>
                          <Text style={[styles.historyBadgeText, { color: badgeColor }]}>
                            {appt.status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.historyDate}>{dateStr} at {timeStr}</Text>
                      {appt.notes ? <Text style={styles.historyNotes} numberOfLines={2}>{appt.notes}</Text> : null}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:  { flex: 1 },
  content: { paddingBottom: 100 },

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon:  { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg, ...shadows.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc:  { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  addBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: 14, paddingHorizontal: spacing.xl, gap: spacing.sm },
  addBtnText: { ...typography.h4, color: colors.white },

  sectionTitle: { ...typography.h4, color: colors.textPrimary, paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },

  vehicleCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  vehicleIconBox: { width: 52, height: 52, borderRadius: borderRadius.md, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  vehicleInfo:    { flex: 1 },
  vehicleName:    { ...typography.h4, color: colors.textPrimary, marginBottom: 2 },
  vehiclePlate:   { ...typography.bodySmall, color: colors.secondary, fontWeight: '700', marginBottom: 2 },
  vehicleColor:   { ...typography.small, color: colors.textSecondary },
  vehicleVin:     { ...typography.small, color: colors.textMuted, marginTop: 2 },
  deleteBtn:      { padding: spacing.sm },

  historySheet:        { maxHeight: '70%' },
  historySubtitle:     { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  historyCenter:       { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  historyEmptyTitle:   { ...typography.h4, color: colors.textPrimary },
  historyEmptyDesc:    { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.md },
  historyCard:         { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  historyCardLast:     { borderBottomWidth: 0 },
  historyCardTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  historyService:      { ...typography.h4, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  historyBadge:        { borderWidth: 1, borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  historyBadgeText:    { fontSize: 11, fontWeight: '600' as const },
  historyDate:         { ...typography.small, color: colors.textSecondary },
  historyNotes:        { ...typography.small, color: colors.textMuted, marginTop: 4 },

  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', ...shadows.lg },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '92%' },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle:   { ...typography.h3, color: colors.textPrimary },

  errorBox:  { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.error },

  field:        { marginBottom: spacing.md },
  fieldLabel:   { ...typography.label, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 },
  optional:     { color: colors.textMuted, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  input:        { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 12, ...typography.body, color: colors.textPrimary, backgroundColor: colors.background },
  inputDisabled:{ opacity: 0.5 },
  inputRow:     { flexDirection: 'row', alignItems: 'center' },
  inputFlex:    { flex: 1 },
  rowSpinner:   { marginLeft: spacing.sm },

  suggestionList:         { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, backgroundColor: colors.surface, marginTop: 4, ...shadows.sm },
  suggestionItem:         { paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  suggestionItemLast:     { borderBottomWidth: 0 },
  suggestionText:         { ...typography.body, color: colors.textPrimary },
  suggestionTextSelected: { ...typography.body, color: colors.primary, fontWeight: '700' as const },
  dropdownBtn:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownValue:          { ...typography.body, color: colors.textPrimary, flex: 1 },
  dropdownPlaceholder:    { ...typography.body, color: colors.textMuted, flex: 1 },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: borderRadius.sm,
    gap: 5,
  },
  modeBtnActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  modeBtnText: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '500' },
  modeBtnTextActive: { color: colors.primary, fontWeight: '700' },

  plateRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 12,
    backgroundColor: colors.background,
  },
  stateBtnPlaceholder: { ...typography.body, color: colors.textMuted, minWidth: 44 },
  stateBtnValue:       { ...typography.body, color: colors.textPrimary, fontWeight: '600', minWidth: 44 },
  plateInput:          { flex: 1 },
  lookupBtn: {
    width: 44, height: 44, borderRadius: borderRadius.md,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  lookupBtnDisabled: { opacity: 0.4 },
  plateError: { ...typography.small, color: colors.error, marginTop: 6 },

  stateDropdown: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    marginTop: 4,
    ...shadows.sm,
  },
  stateItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  stateItemActive:     { backgroundColor: 'rgba(15,32,68,0.04)' },
  stateItemText:       { ...typography.body, color: colors.textPrimary, flex: 1 },
  stateItemTextActive: { color: colors.primary, fontWeight: '600' },
  stateItemAbbr:       { ...typography.bodySmall, color: colors.textMuted },

  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  orLine:    { flex: 1, height: 1, backgroundColor: colors.border },
  orText:    { ...typography.bodySmall, color: colors.textMuted, paddingHorizontal: spacing.sm },

  saveBtn:         { backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm, ...shadows.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { ...typography.h4, color: colors.primary },
});
