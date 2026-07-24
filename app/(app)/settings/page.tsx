'use client'
import { useEffect, useState } from 'react'
import { Save, IndianRupee, Percent, BadgeInfo, Users, Plus, Trash2, KeyRound, ShieldCheck, User } from 'lucide-react'

const FIELDS = [
  { key: 'ac_rate_gst',  label: 'AC Rate (with GST)',       prefix: '₹', icon: IndianRupee, desc: 'Per coach per trip rate for AC coaches including GST' },
  { key: 'nac_rate_gst', label: 'NAC Rate (with GST)',      prefix: '₹', icon: IndianRupee, desc: 'Per coach per trip rate for NAC coaches including GST' },
  { key: 'ext_rate_gst', label: 'Exterior Rate (with GST)', prefix: '₹', icon: IndianRupee, desc: 'Per coach per trip rate for exterior cleaning including GST' },
  { key: 'gst_pct',      label: 'GST %',                    prefix: '',  icon: Percent,     desc: 'Current GST percentage applied to all rates' },
  { key: 'min_wages',    label: 'Minimum Wages / day',      prefix: '₹', icon: IndianRupee, desc: 'Used for manpower penalty calculation. Update every ~6 months.' },
]

type UserRow = { username: string; role: string; created_at: string }

export default function SettingsPage() {
  /* ── Billing config ── */
  const [cfg,    setCfg]    = useState<Record<string, string>>({})
  const [saved,  setSaved]  = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetch('/api/config').then(r => r.json()).then(setCfg) }, [])

  const gst = Number(cfg.gst_pct) || 18
  function noGST(key: string) {
    const v = Number(cfg[key]); if (!v) return '—'
    return `₹${(v * 100 / (100 + gst)).toFixed(2)}`
  }

  async function saveCfg() {
    setSaving(true)
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  /* ── User management ── */
  const [users,        setUsers]        = useState<UserRow[]>([])
  const [newUser,      setNewUser]      = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [newRole,      setNewRole]      = useState<'user' | 'admin'>('user')
  const [addingUser,   setAddingUser]   = useState(false)
  const [userMsg,      setUserMsg]      = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  // Reset password modal state
  const [resetTarget,  setResetTarget]  = useState<string | null>(null)
  const [resetPass,    setResetPass]    = useState('')
  const [resetting,    setResetting]    = useState(false)

  async function loadUsers() {
    const r = await fetch('/api/auth/users'); if (!r.ok) return
    const d = await r.json(); setUsers(d.users)
  }
  useEffect(() => { loadUsers() }, [])

  async function addUser(e: React.FormEvent) {
    e.preventDefault(); setUserMsg(null); setAddingUser(true)
    const r = await fetch('/api/auth/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUser, password: newPass, role: newRole }),
    })
    const d = await r.json()
    if (r.ok) {
      setUserMsg({ type: 'ok', text: `User "${newUser}" created successfully` })
      setNewUser(''); setNewPass(''); setNewRole('user')
      loadUsers()
    } else {
      setUserMsg({ type: 'err', text: d.error || 'Failed to create user' })
    }
    setAddingUser(false)
  }

  async function deleteUser(username: string) {
    if (!confirm(`Delete user "${username}"?`)) return
    await fetch(`/api/auth/users?username=${encodeURIComponent(username)}`, { method: 'DELETE' })
    loadUsers()
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault(); setResetting(true)
    const r = await fetch('/api/auth/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: resetTarget, newPassword: resetPass }),
    })
    if (r.ok) { setResetTarget(null); setResetPass('') }
    setResetting(false)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', margin: 0 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '3px 0 0' }}>Billing rates and user management</p>
      </div>

      {/* ── Billing config card ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Billing Configuration</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FIELDS.map(({ key, label, prefix, icon: Icon, desc }, idx) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: idx < FIELDS.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} style={{ color: 'var(--primary)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-4)', margin: '2px 0 0' }}>{desc}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-2)', border: '1.5px solid var(--border-md)', borderRadius: 10, padding: '7px 12px', width: 140 }}>
                {prefix && <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 600 }}>{prefix}</span>}
                <input type="number" step="0.01" value={cfg[key] ?? ''} onChange={e => setCfg(c => ({ ...c, [key]: e.target.value }))}
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font)', minWidth: 0 }} />
              </div>
              {key.endsWith('_gst') && (
                <div style={{ fontSize: 11, color: 'var(--text-4)', width: 110, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BadgeInfo size={11} />w/o GST: {noGST(key)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={saveCfg} disabled={saving} className="btn btn-primary">
          <Save size={14} />{saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ Saved</span>}
      </div>

      {/* ── User Management card ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Users size={16} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>User Management</h2>
        </div>

        {/* User list */}
        <div style={{ padding: '8px 0' }}>
          {users.map(u => (
            <div key={u.username} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: u.role === 'admin' ? 'linear-gradient(135deg,#2563EB,#7C3AED)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {u.role === 'admin' ? <ShieldCheck size={15} color="#fff" /> : <User size={15} style={{ color: 'var(--text-3)' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{u.username}</p>
                <p style={{ fontSize: 11, color: 'var(--text-4)', margin: 0, textTransform: 'capitalize' }}>{u.role}</p>
              </div>
              <button onClick={() => { setResetTarget(u.username); setResetPass('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>
                <KeyRound size={12} /> Reset Password
              </button>
              {u.username !== 'admin' && (
                <button onClick={() => deleteUser(u.username)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--danger)', background: 'rgba(239,68,68,.1)', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p style={{ textAlign: 'center', padding: '20px', fontSize: 13, color: 'var(--text-4)' }}>No users found</p>
          )}
        </div>

        {/* Add user form */}
        <form onSubmit={addUser} style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
            <Plus size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Add New User
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input type="text" className="input" placeholder="Username" required value={newUser}
              onChange={e => setNewUser(e.target.value)} style={{ flex: 1, minWidth: 140, fontSize: 13 }} />
            <input type="password" className="input" placeholder="Password (min 6 chars)" required value={newPass}
              onChange={e => setNewPass(e.target.value)} style={{ flex: 1, minWidth: 160, fontSize: 13 }} />
            <select value={newRole} onChange={e => setNewRole(e.target.value as 'user' | 'admin')}
              style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid var(--border-md)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" disabled={addingUser} className="btn btn-primary" style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
              <Plus size={14} />{addingUser ? 'Adding…' : 'Add User'}
            </button>
          </div>
          {userMsg && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
              background: userMsg.type === 'ok' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
              color: userMsg.type === 'ok' ? '#16a34a' : 'var(--danger)',
              border: `1px solid ${userMsg.type === 'ok' ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}` }}>
              {userMsg.text}
            </div>
          )}
        </form>
      </div>

      {/* ── Reset Password Modal ── */}
      {resetTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="card" style={{ width: 360, padding: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Reset Password</h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 18 }}>Set new password for <strong>{resetTarget}</strong></p>
            <form onSubmit={resetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="password" className="input" placeholder="New password (min 6 chars)" required
                value={resetPass} onChange={e => setResetPass(e.target.value)} autoFocus />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setResetTarget(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid var(--border-md)', background: 'transparent', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={resetting} className="btn btn-primary" style={{ flex: 1, padding: '10px', fontSize: 13 }}>
                  {resetting ? 'Saving…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
