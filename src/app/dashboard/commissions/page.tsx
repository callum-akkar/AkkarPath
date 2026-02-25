'use client'

import { useEffect, useState, useCallback } from 'react'

interface Commission {
  id: string
  amount: number
  status: string
  period: string
  deal: { id: string; name: string; amount: number }
  rep: { id: string; name: string; email: string }
  plan: { id: string; name: string }
  createdAt: string
}

interface User {
  id: string
  name: string
  role: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'badge-yellow',
    approved: 'badge-blue',
    paid: 'badge-green',
  }
  return (
    <span className={styles[status] || 'badge-gray'}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [selectedRep, setSelectedRep] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Generate period
  const [genRepId, setGenRepId] = useState('')
  const [genPeriod, setGenPeriod] = useState('')
  const [showGenerate, setShowGenerate] = useState(false)

  const loadCommissions = useCallback(async () => {
    const params = new URLSearchParams()
    if (selectedPeriod) params.set('period', selectedPeriod)
    if (selectedRep) params.set('repId', selectedRep)

    const res = await fetch(`/api/commissions?${params}`)
    const data = await res.json()
    setCommissions(data.commissions || [])
  }, [selectedPeriod, selectedRep])

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
    ]).then(([usersData, meData]) => {
      setUsers(usersData.users || [])
      setCurrentUser(meData.user || null)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loading) loadCommissions()
  }, [loading, loadCommissions])

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager'

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repId: genRepId, period: genPeriod }),
    })
    setShowGenerate(false)
    loadCommissions()
  }

  async function handleBulkUpdate(status: string) {
    if (selectedIds.size === 0) return
    await fetch('/api/commissions/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), status }),
    })
    setSelectedIds(new Set())
    loadCommissions()
  }

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/commissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadCommissions()
  }

  function toggleSelection(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function toggleAll() {
    if (selectedIds.size === commissions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(commissions.map((c) => c.id)))
    }
  }

  // Get unique periods
  const periods = [...new Set(commissions.map((c) => c.period))].sort().reverse()

  const totalAmount = commissions.reduce((sum, c) => sum + c.amount, 0)
  const pendingAmount = commissions
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0)
  const paidAmount = commissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading commissions...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track and manage commission payouts
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setGenRepId(users[0]?.id || '')
              const now = new Date()
              setGenPeriod(
                `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              )
              setShowGenerate(true)
            }}
            className="btn-primary"
          >
            Generate Commissions
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Paid</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(paidAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          className="input w-48"
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
        >
          <option value="">All Periods</option>
          {periods.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {isAdmin && (
          <select
            className="input w-48"
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
          >
            <option value="">All Reps</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        {isAdmin && selectedIds.size > 0 && (
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleBulkUpdate('approved')}
              className="btn-secondary text-sm"
            >
              Approve ({selectedIds.size})
            </button>
            <button
              onClick={() => handleBulkUpdate('paid')}
              className="btn-success text-sm"
            >
              Mark Paid ({selectedIds.size})
            </button>
          </div>
        )}
      </div>

      {/* Generate Modal */}
      {showGenerate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Generate Commissions</h2>
            <p className="text-sm text-gray-500 mb-4">
              Calculate commissions for a rep based on their closed-won deals in the selected period.
            </p>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="label">Sales Rep</label>
                <select
                  className="input"
                  value={genRepId}
                  onChange={(e) => setGenRepId(e.target.value)}
                  required
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Period (YYYY-MM)</label>
                <input
                  type="month"
                  className="input"
                  value={genPeriod}
                  onChange={(e) => setGenPeriod(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  Generate
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerate(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Commission Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {isAdmin && (
                <th className="table-header w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === commissions.length && commissions.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
              )}
              <th className="table-header">Deal</th>
              <th className="table-header">Rep</th>
              <th className="table-header">Plan</th>
              <th className="table-header">Period</th>
              <th className="table-header">Deal Value</th>
              <th className="table-header">Commission</th>
              <th className="table-header">Status</th>
              {isAdmin && <th className="table-header"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {commissions.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                {isAdmin && (
                  <td className="table-cell">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelection(c.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                )}
                <td className="table-cell font-medium">{c.deal.name}</td>
                <td className="table-cell text-gray-600">{c.rep.name}</td>
                <td className="table-cell text-gray-600">{c.plan.name}</td>
                <td className="table-cell text-gray-600">{c.period}</td>
                <td className="table-cell">{formatCurrency(c.deal.amount)}</td>
                <td className="table-cell font-semibold text-brand-600">
                  {formatCurrency(c.amount)}
                </td>
                <td className="table-cell">
                  <StatusBadge status={c.status} />
                </td>
                {isAdmin && (
                  <td className="table-cell text-right">
                    <select
                      value={c.status}
                      onChange={(e) => handleStatusChange(c.id, e.target.value)}
                      className="text-sm border border-gray-200 rounded-md px-2 py-1"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="paid">Paid</option>
                    </select>
                  </td>
                )}
              </tr>
            ))}
            {commissions.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 9 : 7}
                  className="table-cell text-center text-gray-500 py-12"
                >
                  No commissions found. Generate commissions from closed-won deals.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
