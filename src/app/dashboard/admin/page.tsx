'use client'

import { useEffect, useState, useCallback } from 'react'

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  managerId: string | null
  manager: { id: string; name: string } | null
  jobTitle: string | null
  salesforceUserId: string | null
}

interface SyncLog {
  placements?: { recordsProcessed: number; recordsCreated: number; recordsUpdated: number }
  timesheets?: { recordsProcessed: number; recordsCreated: number; recordsUpdated: number }
  syncedCount?: number
}

function dateToPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'sync' | 'calculate'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateUser, setShowCreateUser] = useState(false)


  // User form
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'REP', managerId: '', salesforceUserId: '', jobTitle: '' })

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncLog | null>(null)

  // Calculate state
  const [calcPeriod, setCalcPeriod] = useState(dateToPeriod(new Date()))
  const [calculating, setCalculating] = useState(false)
  const [calcResult, setCalcResult] = useState<{ totalUsers: number; totalEntries: number } | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/users')
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function createUser() {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...userForm,
        managerId: userForm.managerId || undefined,
        salesforceUserId: userForm.salesforceUserId || undefined,
        jobTitle: userForm.jobTitle || undefined,
      }),
    })
    setShowCreateUser(false)
    setUserForm({ name: '', email: '', password: '', role: 'REP', managerId: '', salesforceUserId: '', jobTitle: '' })
    loadUsers()
  }

  async function runSalesforceSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync/salesforce', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
    } catch {
      setSyncResult(null)
    }
    setSyncing(false)
  }

  async function runHiBobSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync/hibob', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
    } catch {
      setSyncResult(null)
    }
    setSyncing(false)
  }

  async function runCalculation() {
    setCalculating(true)
    setCalcResult(null)
    try {
      const res = await fetch('/api/commissions/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: calcPeriod }),
      })
      const data = await res.json()
      setCalcResult(data)
    } catch {
      setCalcResult(null)
    }
    setCalculating(false)
  }

  async function bulkApprove() {
    await fetch('/api/commissions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: calcPeriod }),
    })
    alert('All pending entries approved for ' + calcPeriod)
  }

  async function bulkPay() {
    await fetch('/api/commissions/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: calcPeriod }),
    })
    alert('All approved entries marked as paid for ' + calcPeriod)
  }

  const tabs = [
    { key: 'users', label: 'Users' },
    { key: 'sync', label: 'Data Sync' },
    { key: 'calculate', label: 'Calculate & Pay' },
  ] as const

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Console</h1>
        <p className="text-gray-500 text-sm mt-1">System administration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{users.length} users</span>
              <a href="/dashboard/team" className="text-sm text-brand-600 hover:text-brand-700 font-medium">Manage team structure &rarr;</a>
            </div>
            <button onClick={() => setShowCreateUser(true)} className="btn-primary">Create User</button>
          </div>

          {showCreateUser && (
            <div className="card p-6 mb-4 border-2 border-brand-200">
              <h3 className="font-semibold mb-4">Create New User</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="label">Name</label><input className="input" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} /></div>
                <div><label className="label">Email</label><input className="input" type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} /></div>
                <div><label className="label">Password</label><input className="input" type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} /></div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                    <option value="REP">Rep</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label">Manager</label>
                  <select className="input" value={userForm.managerId} onChange={e => setUserForm({ ...userForm, managerId: e.target.value })}>
                    <option value="">None</option>
                    {users.filter(u => u.role !== 'REP').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div><label className="label">SF User ID</label><input className="input" value={userForm.salesforceUserId} onChange={e => setUserForm({ ...userForm, salesforceUserId: e.target.value })} /></div>
                <div><label className="label">Job Title</label><input className="input" value={userForm.jobTitle} onChange={e => setUserForm({ ...userForm, jobTitle: e.target.value })} /></div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={createUser} className="btn-primary">Create</button>
                <button onClick={() => setShowCreateUser(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Name</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Manager</th>
                  <th className="table-header">SF ID</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="table-cell text-center text-gray-500">Loading...</td></tr>
                ) : users.map(user => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.jobTitle || ''}</p>
                    </td>
                    <td className="table-cell text-sm">{user.email}</td>
                    <td className="table-cell">
                      <span className={`text-xs font-medium ${user.role === 'ADMIN' ? 'text-purple-600' : user.role === 'MANAGER' ? 'text-blue-600' : 'text-gray-600'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="table-cell text-sm text-gray-600">{user.manager?.name || '-'}</td>
                    <td className="table-cell text-xs text-gray-500 font-mono">{user.salesforceUserId || '-'}</td>
                    <td className="table-cell">
                      <span className={user.isActive ? 'badge-green' : 'badge-red'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <a href="/dashboard/team" className="text-xs text-brand-600 hover:text-brand-700">
                        Edit in Team &rarr;
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Sync Tab */}
      {tab === 'sync' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Salesforce Sync</h3>
            <p className="text-sm text-gray-500 mb-4">Sync placements and timesheets from Salesforce. This will create/update records based on Salesforce data.</p>
            <button onClick={runSalesforceSync} disabled={syncing} className="btn-primary">
              {syncing ? 'Syncing...' : 'Run Salesforce Sync'}
            </button>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-2">HiBob Sync</h3>
            <p className="text-sm text-gray-500 mb-4">Sync salary and employee data from HiBob.</p>
            <button onClick={runHiBobSync} disabled={syncing} className="btn-primary">
              {syncing ? 'Syncing...' : 'Run HiBob Sync'}
            </button>
          </div>

          {syncResult && (
            <div className="card p-6 bg-green-50 border border-green-200">
              <h3 className="font-semibold text-green-800 mb-2">Sync Complete</h3>
              <pre className="text-sm text-green-700 whitespace-pre-wrap">
                {JSON.stringify(syncResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Calculate & Pay Tab */}
      {tab === 'calculate' && (
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Commission Calculation</h3>
            <p className="text-sm text-gray-500 mb-4">Run the commission engine for a period. This recalculates all PENDING entries (never touches PAID).</p>
            <div className="flex items-center gap-4">
              <input type="month" value={calcPeriod} onChange={e => setCalcPeriod(e.target.value)} className="input" />
              <button onClick={runCalculation} disabled={calculating} className="btn-primary">
                {calculating ? 'Calculating...' : 'Run Calculation'}
              </button>
            </div>
            {calcResult && (
              <div className="mt-4 p-4 bg-brand-50 rounded-lg">
                <p className="text-sm"><strong>{calcResult.totalUsers}</strong> users processed</p>
                <p className="text-sm"><strong>{calcResult.totalEntries}</strong> commission entries generated</p>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Approval & Payment</h3>
            <p className="text-sm text-gray-500 mb-4">Bulk approve or mark as paid for a period.</p>
            <div className="flex flex-wrap items-center gap-4">
              <input type="month" value={calcPeriod} onChange={e => setCalcPeriod(e.target.value)} className="input" />
              <button onClick={bulkApprove} className="btn-primary">Approve All Pending</button>
              <button onClick={bulkPay} className="btn-success">Mark All as Paid</button>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Manual Payout Entry</h3>
            <p className="text-sm text-gray-500 mb-4">Create a manual commission entry or bonus.</p>
            <div className="flex gap-2">
              <a href="/dashboard/commissions" className="btn-secondary text-sm">Go to Commissions &rarr;</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
