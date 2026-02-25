'use client'

import { useEffect, useState, useCallback } from 'react'

interface Rep {
  id: string
  name: string
  email: string
}

interface Deal {
  id: string
  name: string
  amount: number
  status: string
  closeDate: string | null
  rep: Rep
  commissions: { id: string; amount: number; status: string }[]
  createdAt: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'badge-blue',
    closed_won: 'badge-green',
    closed_lost: 'badge-red',
  }
  const labels: Record<string, string> = {
    open: 'Open',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost',
  }
  return <span className={styles[status] || 'badge-gray'}>{labels[status] || status}</span>
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formStatus, setFormStatus] = useState('open')
  const [formCloseDate, setFormCloseDate] = useState('')
  const [formRepId, setFormRepId] = useState('')

  const loadData = useCallback(async () => {
    const [dealsRes, usersRes, meRes] = await Promise.all([
      fetch('/api/deals'),
      fetch('/api/users'),
      fetch('/api/auth/me'),
    ])
    const dealsData = await dealsRes.json()
    const usersData = await usersRes.json()
    const meData = await meRes.json()
    setDeals(dealsData.deals || [])
    setUsers(usersData.users || [])
    setCurrentUser(meData.user || null)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager'

  function openNewForm() {
    setEditingDeal(null)
    setFormName('')
    setFormAmount('')
    setFormStatus('open')
    setFormCloseDate('')
    setFormRepId(currentUser?.id || '')
    setShowForm(true)
  }

  function openEditForm(deal: Deal) {
    setEditingDeal(deal)
    setFormName(deal.name)
    setFormAmount(deal.amount.toString())
    setFormStatus(deal.status)
    setFormCloseDate(deal.closeDate ? deal.closeDate.split('T')[0] : '')
    setFormRepId(deal.rep.id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      name: formName,
      amount: formAmount,
      status: formStatus,
      closeDate: formCloseDate || null,
      repId: formRepId,
    }

    if (editingDeal) {
      await fetch(`/api/deals/${editingDeal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    setShowForm(false)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this deal?')) return
    await fetch(`/api/deals/${id}`, { method: 'DELETE' })
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading deals...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track and manage sales deals
          </p>
        </div>
        <button onClick={openNewForm} className="btn-primary">
          + New Deal
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingDeal ? 'Edit Deal' : 'New Deal'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Deal Name</label>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Acme Corp - Enterprise"
                  required
                />
              </div>
              <div>
                <label className="label">Amount ($)</label>
                <input
                  type="number"
                  className="input"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  placeholder="50000"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                >
                  <option value="open">Open</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
              </div>
              <div>
                <label className="label">Close Date</label>
                <input
                  type="date"
                  className="input"
                  value={formCloseDate}
                  onChange={(e) => setFormCloseDate(e.target.value)}
                />
              </div>
              {isAdmin && (
                <div>
                  <label className="label">Assigned Rep</label>
                  <select
                    className="input"
                    value={formRepId}
                    onChange={(e) => setFormRepId(e.target.value)}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingDeal ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deals Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Deal</th>
              <th className="table-header">Amount</th>
              <th className="table-header">Status</th>
              <th className="table-header">Rep</th>
              <th className="table-header">Close Date</th>
              <th className="table-header">Commission</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deals.map((deal) => (
              <tr key={deal.id} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell font-medium">{deal.name}</td>
                <td className="table-cell">{formatCurrency(deal.amount)}</td>
                <td className="table-cell">
                  <StatusBadge status={deal.status} />
                </td>
                <td className="table-cell text-gray-600">{deal.rep.name}</td>
                <td className="table-cell text-gray-600">
                  {deal.closeDate
                    ? new Date(deal.closeDate).toLocaleDateString()
                    : '-'}
                </td>
                <td className="table-cell">
                  {deal.commissions.length > 0
                    ? formatCurrency(
                        deal.commissions.reduce((sum, c) => sum + c.amount, 0)
                      )
                    : '-'}
                </td>
                <td className="table-cell text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEditForm(deal)}
                      className="text-brand-600 hover:text-brand-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(deal.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr>
                <td colSpan={7} className="table-cell text-center text-gray-500 py-12">
                  No deals yet. Create your first deal to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
