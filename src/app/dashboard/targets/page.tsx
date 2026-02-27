'use client'

import { useEffect, useState, useCallback } from 'react'
import { getFiscalYear, getQuartersForFY, getQuarterLabel, getFiscalYearOptions } from '@/lib/fiscal-year'

interface Target {
  id: string
  userId: string
  user: { id: string; name: string; email: string }
  period: string
  nfiTargetGBP: number
  placementTargetCount: number | null
  contractRevenueTarget: number | null
}

interface TeamTarget {
  id: string
  managerId: string
  manager: { id: string; name: string; email: string }
  period: string
  nfiTargetGBP: number
  placementTarget: number | null
}

interface ClientTarget {
  id: string
  userId: string
  user: { id: string; name: string; email: string }
  accountId: string
  account: { id: string; salesforceId: string; name: string }
  period: string
  nfiTargetGBP: number
}

interface User {
  id: string
  name: string
  email: string
  role?: string
}

interface SFAccount {
  id: string
  name: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)
}

type TabKey = 'individual' | 'team' | 'client'

export default function TargetsPage() {
  const [tab, setTab] = useState<TabKey>('individual')
  const [targets, setTargets] = useState<Target[]>([])
  const [teamTargets, setTeamTargets] = useState<TeamTarget[]>([])
  const [clientTargets, setClientTargets] = useState<ClientTarget[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [accounts, setAccounts] = useState<SFAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(() => getFiscalYear(new Date()))
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [clientFilterUserId, setClientFilterUserId] = useState('')

  const quarters = getQuartersForFY(fiscalYear)
  const fyOptions = getFiscalYearOptions(6)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [targetsRes, teamTargetsRes, clientTargetsRes, usersRes, accountsRes] = await Promise.all([
      fetch(`/api/targets?fiscalYear=${fiscalYear}`),
      fetch(`/api/team-targets?fiscalYear=${fiscalYear}`),
      fetch(`/api/client-targets?fiscalYear=${fiscalYear}${clientFilterUserId ? `&userId=${clientFilterUserId}` : ''}`),
      fetch('/api/users'),
      fetch('/api/targets?type=accounts'),
    ])
    const targetsData = await targetsRes.json()
    const teamTargetsData = await teamTargetsRes.json()
    const clientTargetsData = await clientTargetsRes.json()
    const usersData = await usersRes.json()

    let accountsData: SFAccount[] = []
    try {
      const accRes = await accountsRes.json()
      if (Array.isArray(accRes)) accountsData = accRes
    } catch {
      // accounts may not be available
    }

    setTargets(Array.isArray(targetsData) ? targetsData : [])
    setTeamTargets(Array.isArray(teamTargetsData) ? teamTargetsData : [])
    setClientTargets(Array.isArray(clientTargetsData) ? clientTargetsData : [])
    setUsers(Array.isArray(usersData) ? usersData : [])
    setAccounts(accountsData)
    setLoading(false)
  }, [fiscalYear, clientFilterUserId])

  useEffect(() => { loadData() }, [loadData])

  // ── Individual Targets ──────────────────────────────────────────
  function getTarget(userId: string, period: string): Target | undefined {
    return targets.find(t => t.userId === userId && t.period === period)
  }

  async function saveTarget(userId: string, period: string, value: string) {
    const nfiTargetGBP = parseFloat(value)
    if (isNaN(nfiTargetGBP)) return
    await fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, period, nfiTargetGBP }),
    })
    setEditingCell(null)
    loadData()
  }

  function startEdit(cellKey: string, currentValue: number | null) {
    setEditingCell(cellKey)
    setEditValue(currentValue !== null ? String(Number(currentValue)) : '')
  }

  function getUserFYTotal(userId: string): number {
    return quarters.reduce((sum, q) => {
      const t = getTarget(userId, q)
      return sum + (t ? Number(t.nfiTargetGBP) : 0)
    }, 0)
  }

  function getQuarterTotal(period: string): number {
    return users.reduce((sum, u) => {
      const t = getTarget(u.id, period)
      return sum + (t ? Number(t.nfiTargetGBP) : 0)
    }, 0)
  }

  const grandTotal = quarters.reduce((sum, q) => sum + getQuarterTotal(q), 0)

  // ── Team Targets ────────────────────────────────────────────────
  const managers = users.filter(u => u.role === 'MANAGER' || u.role === 'ADMIN')

  function getTeamTarget(managerId: string, period: string): TeamTarget | undefined {
    return teamTargets.find(t => t.managerId === managerId && t.period === period)
  }

  async function saveTeamTarget(managerId: string, period: string, value: string) {
    const nfiTargetGBP = parseFloat(value)
    if (isNaN(nfiTargetGBP)) return
    await fetch('/api/team-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managerId, period, nfiTargetGBP }),
    })
    setEditingCell(null)
    loadData()
  }

  function getManagerFYTotal(managerId: string): number {
    return quarters.reduce((sum, q) => {
      const t = getTeamTarget(managerId, q)
      return sum + (t ? Number(t.nfiTargetGBP) : 0)
    }, 0)
  }

  function getTeamQuarterTotal(period: string): number {
    return managers.reduce((sum, m) => {
      const t = getTeamTarget(m.id, period)
      return sum + (t ? Number(t.nfiTargetGBP) : 0)
    }, 0)
  }

  const teamGrandTotal = quarters.reduce((sum, q) => sum + getTeamQuarterTotal(q), 0)

  // ── Client Targets ──────────────────────────────────────────────
  // Group client targets by user+account
  type ClientTargetRow = { userId: string; userName: string; accountId: string; accountName: string; targets: Record<string, number> }

  const clientTargetRows: ClientTargetRow[] = (() => {
    const map = new Map<string, ClientTargetRow>()
    for (const ct of clientTargets) {
      const key = `${ct.userId}-${ct.accountId}`
      if (!map.has(key)) {
        map.set(key, {
          userId: ct.userId,
          userName: ct.user.name,
          accountId: ct.accountId,
          accountName: ct.account.name,
          targets: {},
        })
      }
      map.get(key)!.targets[ct.period] = Number(ct.nfiTargetGBP)
    }
    return Array.from(map.values()).sort((a, b) => a.userName.localeCompare(b.userName) || a.accountName.localeCompare(b.accountName))
  })()

  async function saveClientTarget(userId: string, accountId: string, period: string, value: string) {
    const nfiTargetGBP = parseFloat(value)
    if (isNaN(nfiTargetGBP)) return
    await fetch('/api/client-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, accountId, period, nfiTargetGBP }),
    })
    setEditingCell(null)
    loadData()
  }

  function getClientFYTotal(row: ClientTargetRow): number {
    return quarters.reduce((sum, q) => sum + (row.targets[q] || 0), 0)
  }

  const clientGrandTotal = clientTargetRows.reduce((sum, row) => sum + getClientFYTotal(row), 0)

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'individual', label: 'Individual Targets' },
    { key: 'team', label: 'Team Targets' },
    { key: 'client', label: 'Client Targets' },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading targets...</div></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quarterly Targets</h1>
          <p className="text-gray-500 text-sm mt-1">NFI targets by team member and fiscal quarter (UK April–March)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => {
            const idx = fyOptions.indexOf(fiscalYear)
            if (idx > 0) setFiscalYear(fyOptions[idx - 1])
          }} className="btn-secondary text-sm">&larr;</button>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="input text-lg font-semibold"
          >
            {fyOptions.map(fy => (
              <option key={fy} value={fy}>{fy.replace('FY', 'FY ')}</option>
            ))}
          </select>
          <button onClick={() => {
            const idx = fyOptions.indexOf(fiscalYear)
            if (idx < fyOptions.length - 1) setFiscalYear(fyOptions[idx + 1])
          }} className="btn-secondary text-sm">&rarr;</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Individual Targets Tab ────────────────────────────────── */}
      {tab === 'individual' && (
        <>
          <div className="card p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm text-gray-500">Fiscal Year Total (all users): </span>
                <span className="text-lg font-bold text-brand-600">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex gap-4 sm:gap-6 overflow-x-auto">
                {quarters.map((q, i) => (
                  <div key={q} className="text-center">
                    <span className="text-xs text-gray-500">Q{i + 1}</span>
                    <p className="text-sm font-semibold">{formatCurrency(getQuarterTotal(q))}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header sticky left-0 bg-white z-10 min-w-[180px]">Team Member</th>
                    {quarters.map((q, i) => (
                      <th key={q} className="table-header text-center min-w-[140px]">
                        {getQuarterLabel(i + 1)}
                      </th>
                    ))}
                    <th className="table-header text-right min-w-[120px]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const fyTotal = getUserFYTotal(user.id)
                    return (
                      <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="table-cell sticky left-0 bg-white z-10">
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </td>
                        {quarters.map(q => {
                          const cellKey = `ind-${user.id}-${q}`
                          const target = getTarget(user.id, q)
                          const isEditing = editingCell === cellKey
                          return (
                            <td key={q} className="table-cell text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="input text-sm text-center w-28"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => saveTarget(user.id, q, editValue)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveTarget(user.id, q, editValue) }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => startEdit(cellKey, target ? Number(target.nfiTargetGBP) : null)}
                                  className="text-sm hover:bg-brand-50 px-2 py-1 rounded w-full"
                                >
                                  {target ? formatCurrency(Number(target.nfiTargetGBP)) : '-'}
                                </button>
                              )}
                            </td>
                          )
                        })}
                        <td className="table-cell text-right">
                          <span className="text-sm font-semibold">{formatCurrency(fyTotal)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Team Targets Tab ──────────────────────────────────────── */}
      {tab === 'team' && (
        <>
          <div className="card p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm text-gray-500">Team Targets Total: </span>
                <span className="text-lg font-bold text-brand-600">{formatCurrency(teamGrandTotal)}</span>
              </div>
              <div className="flex gap-4 sm:gap-6 overflow-x-auto">
                {quarters.map((q, i) => (
                  <div key={q} className="text-center">
                    <span className="text-xs text-gray-500">Q{i + 1}</span>
                    <p className="text-sm font-semibold">{formatCurrency(getTeamQuarterTotal(q))}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header sticky left-0 bg-white z-10 min-w-[180px]">Manager</th>
                    {quarters.map((q, i) => (
                      <th key={q} className="table-header text-center min-w-[140px]">
                        {getQuarterLabel(i + 1)}
                      </th>
                    ))}
                    <th className="table-header text-right min-w-[120px]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  {managers.map(mgr => {
                    const fyTotal = getManagerFYTotal(mgr.id)
                    return (
                      <tr key={mgr.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="table-cell sticky left-0 bg-white z-10">
                          <p className="text-sm font-medium">{mgr.name}</p>
                          <p className="text-xs text-gray-500">{mgr.email}</p>
                        </td>
                        {quarters.map(q => {
                          const cellKey = `team-${mgr.id}-${q}`
                          const target = getTeamTarget(mgr.id, q)
                          const isEditing = editingCell === cellKey
                          return (
                            <td key={q} className="table-cell text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="input text-sm text-center w-28"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => saveTeamTarget(mgr.id, q, editValue)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveTeamTarget(mgr.id, q, editValue) }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => startEdit(cellKey, target ? Number(target.nfiTargetGBP) : null)}
                                  className="text-sm hover:bg-brand-50 px-2 py-1 rounded w-full"
                                >
                                  {target ? formatCurrency(Number(target.nfiTargetGBP)) : '-'}
                                </button>
                              )}
                            </td>
                          )
                        })}
                        <td className="table-cell text-right">
                          <span className="text-sm font-semibold">{formatCurrency(fyTotal)}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {managers.length === 0 && (
                    <tr><td colSpan={quarters.length + 2} className="table-cell text-center text-gray-500">No managers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Client Targets Tab ────────────────────────────────────── */}
      {tab === 'client' && (
        <>
          <div className="card p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-sm text-gray-500">Client Targets Total: </span>
                <span className="text-lg font-bold text-brand-600">{formatCurrency(clientGrandTotal)}</span>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={clientFilterUserId}
                  onChange={e => setClientFilterUserId(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">All Account Managers</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header sticky left-0 bg-white z-10 min-w-[140px]">AM Name</th>
                    <th className="table-header min-w-[160px]">Client</th>
                    {quarters.map((q, i) => (
                      <th key={q} className="table-header text-center min-w-[140px]">
                        {getQuarterLabel(i + 1)}
                      </th>
                    ))}
                    <th className="table-header text-right min-w-[120px]">FY Total</th>
                  </tr>
                </thead>
                <tbody>
                  {clientTargetRows.map(row => {
                    const fyTotal = getClientFYTotal(row)
                    return (
                      <tr key={`${row.userId}-${row.accountId}`} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="table-cell sticky left-0 bg-white z-10">
                          <p className="text-sm font-medium">{row.userName}</p>
                        </td>
                        <td className="table-cell">
                          <p className="text-sm">{row.accountName}</p>
                        </td>
                        {quarters.map(q => {
                          const cellKey = `client-${row.userId}-${row.accountId}-${q}`
                          const val = row.targets[q]
                          const isEditing = editingCell === cellKey
                          return (
                            <td key={q} className="table-cell text-center">
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="input text-sm text-center w-28"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onBlur={() => saveClientTarget(row.userId, row.accountId, q, editValue)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveClientTarget(row.userId, row.accountId, q, editValue) }}
                                  autoFocus
                                />
                              ) : (
                                <button
                                  onClick={() => startEdit(cellKey, val !== undefined ? val : null)}
                                  className="text-sm hover:bg-brand-50 px-2 py-1 rounded w-full"
                                >
                                  {val !== undefined ? formatCurrency(val) : '-'}
                                </button>
                              )}
                            </td>
                          )
                        })}
                        <td className="table-cell text-right">
                          <span className="text-sm font-semibold">{formatCurrency(fyTotal)}</span>
                        </td>
                      </tr>
                    )
                  })}
                  {clientTargetRows.length === 0 && (
                    <tr><td colSpan={quarters.length + 3} className="table-cell text-center text-gray-500">No client targets found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
