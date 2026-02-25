'use client'

import { useEffect, useState, useCallback } from 'react'

interface QuotaTarget {
  id: string
  repId: string
  period: string
  periodType: string
  targetAmount: number
  rep: { id: string; name: string; email: string }
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

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function QuotasPage() {
  const [quotas, setQuotas] = useState<QuotaTarget[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkAmount, setBulkAmount] = useState('')
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const reps = users.filter((u) => u.role === 'rep')

  const loadData = useCallback(async () => {
    const [quotasRes, usersRes] = await Promise.all([
      fetch(`/api/quotas?year=${year}`),
      fetch('/api/users'),
    ])
    const quotasData = await quotasRes.json()
    const usersData = await usersRes.json()
    setQuotas(quotasData.quotas || [])
    setUsers(usersData.users || [])
    setLoading(false)
  }, [year])

  useEffect(() => {
    loadData()
  }, [loadData])

  function getQuota(repId: string, month: number): QuotaTarget | undefined {
    const period = `${year}-${String(month).padStart(2, '0')}`
    return quotas.find((q) => q.repId === repId && q.period === period)
  }

  function getRepAnnual(repId: string): number {
    return quotas
      .filter((q) => q.repId === repId)
      .reduce((sum, q) => sum + q.targetAmount, 0)
  }

  async function handleCellSave(repId: string, month: number) {
    const period = `${year}-${String(month).padStart(2, '0')}`
    const amount = parseFloat(editValue)
    if (isNaN(amount)) {
      setEditingCell(null)
      return
    }

    await fetch('/api/quotas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repId, period, targetAmount: amount, periodType: 'monthly' }),
    })

    setEditingCell(null)
    loadData()
  }

  async function handleBulkSet(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/quotas/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year,
        monthlyAmount: bulkAmount,
        repIds: reps.map((r) => r.id),
      }),
    })
    setShowBulkForm(false)
    setBulkAmount('')
    loadData()
  }

  const teamAnnual = reps.reduce((sum, rep) => sum + getRepAnnual(rep.id), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading quotas...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quota Targets</h1>
          <p className="text-gray-500 text-sm mt-1">
            Set monthly quotas for each rep. Click any cell to edit.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            className="input w-32"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {[0, -1, 1].map((offset) => {
              const y = new Date().getFullYear() + offset
              return (
                <option key={y} value={y}>
                  {y}
                </option>
              )
            })}
          </select>
          <button onClick={() => setShowBulkForm(true)} className="btn-primary">
            Bulk Set Quotas
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Team Annual Quota</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(teamAnnual)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Reps with Quotas</p>
          <p className="text-xl font-bold text-brand-600">
            {reps.filter((r) => getRepAnnual(r.id) > 0).length} / {reps.length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Avg Monthly / Rep</p>
          <p className="text-xl font-bold text-emerald-600">
            {reps.length > 0 ? formatCurrency(teamAnnual / reps.length / 12) : '$0'}
          </p>
        </div>
      </div>

      {/* Bulk Modal */}
      {showBulkForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-2">Bulk Set Quotas</h2>
            <p className="text-sm text-gray-500 mb-4">
              Set the same monthly quota for all reps for {year}.
            </p>
            <form onSubmit={handleBulkSet} className="space-y-4">
              <div>
                <label className="label">Monthly Quota per Rep ($)</label>
                <input
                  type="number"
                  className="input"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  placeholder="50000"
                  required
                  min="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This sets {formatCurrency(parseFloat(bulkAmount) || 0)}/mo for each of {reps.length} reps = {formatCurrency((parseFloat(bulkAmount) || 0) * 12)} annual per rep
                </p>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Set All Quotas</button>
                <button type="button" onClick={() => setShowBulkForm(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quota Grid */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header sticky left-0 bg-gray-50 z-10">Rep</th>
              {MONTHS.map((m, idx) => (
                <th key={idx} className="table-header text-center">{m}</th>
              ))}
              <th className="table-header text-center font-bold">Annual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reps.map((rep) => (
              <tr key={rep.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium sticky left-0 bg-white z-10">
                  {rep.name}
                </td>
                {MONTHS.map((_, monthIdx) => {
                  const month = monthIdx + 1
                  const cellKey = `${rep.id}-${month}`
                  const quota = getQuota(rep.id, month)
                  const isEditing = editingCell === cellKey

                  return (
                    <td
                      key={monthIdx}
                      className="table-cell text-center cursor-pointer hover:bg-brand-50 transition-colors"
                      onClick={() => {
                        if (!isEditing) {
                          setEditingCell(cellKey)
                          setEditValue(quota?.targetAmount?.toString() || '')
                        }
                      }}
                    >
                      {isEditing ? (
                        <input
                          type="number"
                          className="w-20 text-center text-sm border border-brand-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleCellSave(rep.id, month)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellSave(rep.id, month)
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className={quota?.targetAmount ? 'text-gray-900' : 'text-gray-300'}>
                          {quota?.targetAmount
                            ? `$${(quota.targetAmount / 1000).toFixed(0)}k`
                            : '-'}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className="table-cell text-center font-bold text-brand-600">
                  {formatCurrency(getRepAnnual(rep.id))}
                </td>
              </tr>
            ))}
            {reps.length === 0 && (
              <tr>
                <td colSpan={14} className="table-cell text-center text-gray-500 py-12">
                  No sales reps found. Add team members first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
