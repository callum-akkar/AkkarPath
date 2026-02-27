'use client'

import { useEffect, useState, useCallback } from 'react'
import { getFiscalYear, getQuartersForFY, getQuarterLabel } from '@/lib/fiscal-year'

interface Target {
  id: string
  userId: string
  user: { id: string; name: string; email: string }
  period: string
  nfiTargetGBP: number
  placementTargetCount: number | null
  contractRevenueTarget: number | null
}

interface User {
  id: string
  name: string
  email: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)
}

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(() => getFiscalYear(new Date()))
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const quarters = getQuartersForFY(fiscalYear)

  // Generate FY options
  const fyOptions = (() => {
    const currentFY = getFiscalYear(new Date())
    const match = currentFY.match(/^FY(\d{2})\/(\d{2})$/)
    if (!match) return [currentFY]
    const startYear = 2000 + parseInt(match[1])
    const options: string[] = []
    for (let i = -2; i <= 3; i++) {
      const y = startYear + i
      options.push(`FY${String(y).slice(2)}/${String(y + 1).slice(2)}`)
    }
    return options
  })()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [targetsRes, usersRes] = await Promise.all([
      fetch(`/api/targets?fiscalYear=${fiscalYear}`),
      fetch('/api/users'),
    ])
    const targetsData = await targetsRes.json()
    const usersData = await usersRes.json()
    setTargets(Array.isArray(targetsData) ? targetsData : [])
    setUsers(Array.isArray(usersData) ? usersData : [])
    setLoading(false)
  }, [fiscalYear])

  useEffect(() => { loadData() }, [loadData])

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

  function startEdit(userId: string, period: string) {
    const target = getTarget(userId, period)
    setEditingCell(`${userId}-${period}`)
    setEditValue(target ? String(Number(target.nfiTargetGBP)) : '')
  }

  // Calculate FY total for a user
  function getUserFYTotal(userId: string): number {
    return quarters.reduce((sum, q) => {
      const t = getTarget(userId, q)
      return sum + (t ? Number(t.nfiTargetGBP) : 0)
    }, 0)
  }

  // Calculate total across all users for a quarter
  function getQuarterTotal(period: string): number {
    return users.reduce((sum, u) => {
      const t = getTarget(u.id, period)
      return sum + (t ? Number(t.nfiTargetGBP) : 0)
    }, 0)
  }

  // Grand total across all users for the FY
  const grandTotal = quarters.reduce((sum, q) => sum + getQuarterTotal(q), 0)

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading targets...</div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
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

      {/* FY Summary */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">Fiscal Year Total (all users): </span>
            <span className="text-lg font-bold text-brand-600">{formatCurrency(grandTotal)}</span>
          </div>
          <div className="flex gap-6">
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
                      const cellKey = `${user.id}-${q}`
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
                              onClick={() => startEdit(user.id, q)}
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
    </div>
  )
}
