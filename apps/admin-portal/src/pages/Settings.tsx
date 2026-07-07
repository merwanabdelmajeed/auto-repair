import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getTenant, updateTenant, type Tenant, type TenantInput } from '../api/tenant';
import { listLocations, createLocation, updateLocation, deleteLocation, type Location, type LocationInput } from '../api/locations';
import { listAdminUsers, inviteAdminUser, updateAdminUser, deleteAdminUser, type AdminUser, type AdminRole, type InviteAdminUserInput } from '../api/adminUsers';
import { ApiError } from '../api/client';

const OWNER_ROLES = new Set(['SUPER_ADMIN', 'TENANT_OWNER']);
const EMPTY_TENANT_FORM: TenantInput = { name: '', address: '', phone: '', contactEmail: '' };
const EMPTY_LOCATION_FORM: LocationInput = { name: '', address: '', phone: '', isActive: true };
const EMPTY_INVITE_FORM: InviteAdminUserInput = { email: '', firstName: '', lastName: '', role: 'LOCATION_MANAGER', locationIds: [] };

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)', borderRadius: '12px', border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: '20px',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: '8px',
  fontSize: '14px', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
};

export default function Settings() {
  const { user } = useAuth();
  const isOwner = !!user && OWNER_ROLES.has(user.role);

  return (
    <div style={{ maxWidth: '900px' }}>
      <BusinessProfileSection isOwner={isOwner} />
      <LocationsSection isOwner={isOwner} />
      <RolesSection isOwner={isOwner} currentUserId={user?.userId ?? ''} />
      <div style={{ textAlign: 'center', marginTop: '24px', color: 'var(--color-text-muted)', fontSize: '12px' }}>
        AutoRepair Admin Portal
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '10px', paddingLeft: '4px' }}>
      {title}
    </h3>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-error)', fontSize: '14px' }}>
      {message}
    </div>
  );
}

// ── Business Profile ──────────────────────────────────────────

function BusinessProfileSection({ isOwner }: { isOwner: boolean }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantInput>(EMPTY_TENANT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const data = await getTenant();
        setTenant(data);
        setForm({ name: data.name, address: data.address ?? '', phone: data.phone ?? '', contactEmail: data.contactEmail ?? '' });
      } catch (e) {
        if (!(e instanceof ApiError && e.statusCode === 404)) setError('Failed to load business profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!form.name.trim()) { setError('Business name is required.'); return; }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await updateTenant(form);
      setTenant(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save business profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--color-primary)', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px', boxShadow: 'var(--shadow-md)' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>🏢</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{tenant?.name || 'Business Profile'}</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px' }}>{isOwner ? 'Tenant Owner' : 'Team Member'}</div>
        </div>
      </div>

      <SectionHeader title="Business Profile" />
      <div style={{ ...cardStyle, padding: '20px 24px' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading…</div>
        ) : (
          <>
            <ErrorBanner message={error} />
            {saved && (
              <div style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: 'var(--color-success)', fontSize: '13px' }}>
                ✓ Business profile saved.
              </div>
            )}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Business Name *</label>
              <input type="text" value={form.name} disabled={!isOwner} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="e.g. Joe's Auto Service" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Address</label>
              <input type="text" value={form.address ?? ''} disabled={!isOwner} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} style={inputStyle} placeholder="1234 Main St, San Jose, CA 95101" />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Business Phone</label>
                <input type="text" value={form.phone ?? ''} disabled={!isOwner} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle} placeholder="(408) 555-0100" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Primary Contact Email</label>
                <input type="text" value={form.contactEmail ?? ''} disabled={!isOwner} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} style={inputStyle} placeholder="admin@joesauto.com" />
              </div>
            </div>
            {isOwner && (
              <button onClick={() => void save()} disabled={saving} style={{ padding: '10px 24px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Locations ──────────────────────────────────────────────────

function LocationsSection({ isOwner }: { isOwner: boolean }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<LocationInput>(EMPTY_LOCATION_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await listLocations();
      setLocations(data);
    } catch {
      // silently fail — section still renders empty
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_LOCATION_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({ name: loc.name, address: loc.address, phone: loc.phone ?? '', isActive: loc.isActive });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.address.trim()) { setFormError('Name and address are required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateLocation(editing.locationId, form);
      } else {
        await createLocation(form);
      }
      setShowModal(false);
      await load();
    } catch {
      setFormError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(loc: Location) {
    if (!window.confirm(`Deactivate "${loc.name}"? It will no longer be bookable by customers.`)) return;
    try {
      await deleteLocation(loc.locationId);
      await load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Failed to deactivate location.');
    }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <SectionHeader title="Locations" />
      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Name', 'Address', 'Phone', 'Status', ''].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</td></tr>
            ) : locations.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>No locations yet.</td></tr>
            ) : locations.map((loc, i) => (
              <tr key={loc.locationId} style={{ borderBottom: i < locations.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>{loc.name}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{loc.address}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{loc.phone || '—'}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', backgroundColor: loc.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.15)', color: loc.isActive ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1px solid ${loc.isActive ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.25)'}` }}>
                    {loc.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isOwner && (
                  <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(loc)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)', marginRight: '6px' }}>Edit</button>
                    {loc.isActive && (
                      <button onClick={() => void handleDeactivate(loc)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-error)' }}>Deactivate</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {isOwner && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border)' }}>
            <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '8px', padding: '9px 18px', border: 'none', cursor: 'pointer' }}>
              + Add Location
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '20px' }}>
              {editing ? 'Edit Location' : 'Add Location'}
            </h2>
            <ErrorBanner message={formError} />
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inputStyle} placeholder="e.g. Fremont" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Address *</label>
              <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} style={inputStyle} placeholder="1234 Main St, Fremont, CA 94536" />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Phone</label>
              <input type="text" value={form.phone ?? ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inputStyle} placeholder="(408) 555-0100" />
            </div>
            {editing && (
              <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" id="locActive" checked={form.isActive ?? true} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                <label htmlFor="locActive" style={{ fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>Active</label>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'transparent', fontSize: '14px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Cancel</button>
              <button onClick={() => void handleSave()} disabled={saving} style={{ padding: '10px 24px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Roles & Access ─────────────────────────────────────────────

function RolesSection({ isOwner, currentUserId }: { isOwner: boolean; currentUserId: string }) {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<InviteAdminUserInput>(EMPTY_INVITE_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const [users, locs] = await Promise.all([listAdminUsers(), listLocations()]);
      setAdminUsers(users);
      setLocations(locs);
    } catch {
      // silently fail — section still renders empty
    } finally {
      setLoading(false);
    }
  }

  function openInvite() {
    setForm(EMPTY_INVITE_FORM);
    setFormError('');
    setShowModal(true);
  }

  function locationNames(ids: string[]): string {
    if (ids.length === 0) return 'All locations';
    return ids.map(id => locations.find(l => l.locationId === id)?.name ?? id).join(', ');
  }

  async function handleInvite() {
    if (!form.email.trim()) { setFormError('Email is required.'); return; }
    if (form.role === 'LOCATION_MANAGER' && form.locationIds.length === 0) {
      setFormError('Select at least one location for a Location Manager.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await inviteAdminUser(form);
      setShowModal(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Failed to send invite.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(u: AdminUser) {
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!window.confirm(`${next === 'INACTIVE' ? 'Deactivate' : 'Reactivate'} ${u.email}?`)) return;
    try {
      await updateAdminUser(u.userId, { status: next });
      await load();
    } catch {
      alert('Failed to update user status.');
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!window.confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    try {
      await deleteAdminUser(u.userId);
      await load();
    } catch {
      alert('Failed to delete user.');
    }
  }

  function toggleLocation(id: string) {
    setForm(p => ({ ...p, locationIds: p.locationIds.includes(id) ? p.locationIds.filter(x => x !== id) : [...p.locationIds, id] }));
  }

  if (!isOwner) return null;

  return (
    <div style={{ marginBottom: '20px' }}>
      <SectionHeader title="Roles & Access" />
      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
              {['Email', 'Role', 'Locations', 'Status', ''].map(col => (
                <th key={col} style={{ textAlign: 'left', padding: '13px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>Loading…</td></tr>
            ) : adminUsers.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>No admin users yet.</td></tr>
            ) : adminUsers.map((u, i) => (
              <tr key={u.userId} style={{ borderBottom: i < adminUsers.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  {u.email}{u.userId === currentUserId && <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}> (You)</span>}
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{u.role === 'TENANT_OWNER' ? 'Tenant Owner' : 'Location Manager'}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>{locationNames(u.locationIds)}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px', backgroundColor: u.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.15)', color: u.status === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-text-muted)', border: `1px solid ${u.status === 'ACTIVE' ? 'rgba(34,197,94,0.25)' : 'rgba(148,163,184,0.25)'}` }}>
                    {u.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  {u.userId !== currentUserId && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => void toggleStatus(u)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button onClick={() => void handleDelete(u)} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-error)' }}>
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={openInvite} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)', fontWeight: 700, fontSize: '14px', borderRadius: '8px', padding: '9px 18px', border: 'none', cursor: 'pointer' }}>
            + Invite Admin User
          </button>
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--color-surface)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '20px' }}>Invite Admin User</h2>
            <ErrorBanner message={formError} />
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Email *</label>
              <input type="text" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inputStyle} placeholder="manager@example.com" />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>First Name</label>
                <input type="text" value={form.firstName ?? ''} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Last Name</label>
                <input type="text" value={form.lastName ?? ''} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Role</label>
              <select
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value as AdminRole }))}
                style={inputStyle}
              >
                <option value="LOCATION_MANAGER">Location Manager</option>
                <option value="TENANT_OWNER">Tenant Owner</option>
              </select>
            </div>
            {form.role === 'LOCATION_MANAGER' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Locations *</label>
                {locations.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No locations yet — add one first.</div>
                ) : locations.map(loc => (
                  <label key={loc.locationId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.locationIds.includes(loc.locationId)} onChange={() => toggleLocation(loc.locationId)} />
                    {loc.name}
                  </label>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'transparent', fontSize: '14px', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>Cancel</button>
              <button onClick={() => void handleInvite()} disabled={saving} style={{ padding: '10px 24px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
