'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface CommissionEntry {
  id: string
  userId: string
  user: { id: string; name: string; email: string }
  planComponent: { id: string; name: string; type: string } | null
  sourcePlacement: { id: string; name: string; salesforceId: string; candidateName: string; account?: { name: string } } | null
  sourceTimesheet: { id: string; name: string; salesforceId: string; candidateName: string; account?: { name: string } } | null
  sourceType: string
  period: string
  grossValue: number
  commissionAmount: number
  rate: number
  status: string
  isClawback: boolean
  isManualOverride: boolean
  manualOverrideNote: string | null
  holdReason: string | null
  payoutDate: string | null
  backdatedFromPeriod: string | null
  createdAt: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(amount)
}

function dateToPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const statusColors: Record<string, string> = {
  PENDING: 'badge-yellow',
  APPROVED: 'badge-blue',
  PAID: 'badge-green',
  HELD: 'badge-red',
}

export default function CommissionsPage() {
  const { data: session } = useSession()
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(dateToPeriod(new Date()))
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  const isAdmin = session?.user?.role === 'ADMIN'
  const isManager = session?.user?.role === 'MANAGER'

  const loadEntries = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ period, page: String(pagination.page), limit: '50' })
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/commissions?${params}`)
    const data = await res.json()
    setEntries(data.entries || [])
    setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
    setSelectedIds(new Set())
    setLoading(false)
  }, [period, statusFilter, pagination.page])

  useEffect(() => { loadEntries() }, [loadEntries])

  async function handleAction(entryId: string, action: string) {
    await fetch(`/api/commissions/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    loadEntries()
  }

  async function handleBulkApprove() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await fetch('/api/commissions/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryIds: ids }),
    })
    loadEntries()
  }

  async function handleBulkPay() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    await fetch('/api/commissions/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryIds: ids }),
    })
    loadEntries()
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function toggleSelectAll() {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(entries.map(e => e.id)))
    }
  }

  const totalCommission = entries.reduce((sum, e) => sum + Number(e.commissionAmount), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
          <p className="text-gray-500 text-sm mt-1">Commission entries for {period}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="HELD">Held</option>
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="card p-4 mb-6 flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <span className="text-sm text-gray-500">Total Entries: </span>
            <span className="font-semibold">{pagination.total}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Total Commission: </span>
            <span className="font-semibold text-brand-600">{formatCurrency(totalCommission)}</span>
          </div>
          {selectedIds.size > 0 && (
            <div>
              <span className="text-sm text-gray-500">Selected: </span>
              <span className="font-semibold">{selectedIds.size}</span>
            </div>
          )}
        </div>
        {(isAdmin || isManager) && selectedIds.size > 0 && (
          <div className="flex gap-2">
            <button onClick={handleBulkApprove} className="btn-primary text-sm">
              Approve Selected
            </button>
            {isAdmin && (
              <button onClick={handleBulkPay} className="btn-secondary text-sm">
                Mark as Paid
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No commission entries found for this period.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {(isAdmin || isManager) && (
                    <th className="table-header w-10">
                      <input type="checkbox" checked={selectedIds.size === entries.length} onChange={toggleSelectAll} />
                    </th>
                  )}
                  {(isAdmin || isManager) && <th className="table-header">Rep</th>}
                  <th className="table-header">Source</th>
                  <th className="table-header">Candidate/Account</th>
                  <th className="table-header">Component</th>
                  <th className="table-header text-right">Gross Value</th>
                  <th className="table-header text-right">Rate</th>
                  <th className="table-header text-right">Commission</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const source = entry.sourcePlacement || entry.sourceTimesheet
                  const accountName = entry.sourcePlacement?.account?.name || entry.sourceTimesheet?.account?.name || ''
                  return (
                    <tr key={entry.id} className={`border-b border-gray-50 hover:bg-gray-50 ${entry.isClawback ? 'bg-red-50' : ''}`}>
                      {(isAdmin || isManager) && (
                        <td className="table-cell">
                          <input type="checkbox" checked={selectedIds.has(entry.id)} onChange={() => toggleSelect(entry.id)} />
                        </td>
                      )}
                      {(isAdmin || isManager) && (
                        <td className="table-cell">
                          <p className="text-sm font-medium">{entry.user.name}</p>
                        </td>
                      )}
                      <td className="table-cell">
                        <p className="text-sm font-medium">{source?.name || 'Manual'}</p>
                        <p className="text-xs text-gray-500">{entry.sourceType}{entry.isClawback ? ' (Clawback)' : ''}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm">{source?.candidateName || '-'}</p>
                        <p className="text-xs text-gray-500">{accountName}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm">{entry.planComponent?.name || '-'}</p>
                        <p className="text-xs text-gray-500">{entry.planComponent?.type || ''}</p>
                      </td>
                      <td className="table-cell text-right">
                        <span className={`text-sm ${entry.isClawback ? 'text-red-600' : ''}`}>
                          {formatCurrency(Number(entry.grossValue))}
                        </span>
                      </td>
                      <td className="table-cell text-right text-sm">
                        {(Number(entry.rate) * 100).toFixed(1)}%
                      </td>
                      <td className="table-cell text-right">
                        <span className={`text-sm font-semibold ${entry.isClawback ? 'text-red-600' : 'text-brand-600'}`}>
                          {formatCurrency(Number(entry.commissionAmount))}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={statusColors[entry.status] || 'badge-gray'}>
                          {entry.status}
                        </span>
                        {entry.isManualOverride && (
                          <span className="badge-gray ml-1" title={entry.manualOverrideNote || ''}>Manual</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          {(isAdmin || isManager) && entry.status === 'PENDING' && (
                            <button onClick={() => handleAction(entry.id, 'approve')} className="text-xs text-blue-600 hover:text-blue-800">Approve</button>
                          )}
                          {isAdmin && entry.status === 'APPROVED' && (
                            <button onClick={() => handleAction(entry.id, 'pay')} className="text-xs text-emerald-600 hover:text-emerald-800">Pay</button>
                          )}
                          {(isAdmin || isManager) && entry.status !== 'PAID' && entry.status !== 'HELD' && (
                            <button onClick={() => handleAction(entry.id, 'hold')} className="text-xs text-red-600 hover:text-red-800">Hold</button>
                          )}
                          {(isAdmin || isManager) && entry.status === 'HELD' && (
                            <button onClick={() => handleAction(entry.id, 'release')} className="text-xs text-blue-600 hover:text-blue-800">Release</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="btn-secondary text-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="btn-secondary text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
