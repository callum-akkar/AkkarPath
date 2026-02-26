'use client'

import { useEffect, useState, useCallback } from 'react'

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
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    return `${year}-${m}`
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [targetsRes, usersRes] = await Promise.all([
      fetch(`/api/targets`),
      fetch('/api/users'),
    ])
    const targetsData = await targetsRes.json()
    const usersData = await usersRes.json()
    setTargets(Array.isArray(targetsData) ? targetsData : [])
    setUsers(Array.isArray(usersData) ? usersData : [])
    setLoading(false)
  }, [])

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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading targets...</div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Targets</h1>
          <p className="text-gray-500 text-sm mt-1">NFI targets by team member and month</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setYear(String(parseInt(year) - 1))} className="btn-secondary text-sm">&larr;</button>
          <span className="text-lg font-semibold">{year}</span>
          <button onClick={() => setYear(String(parseInt(year) + 1))} className="btn-secondary text-sm">&rarr;</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header sticky left-0 bg-white z-10 min-w-[180px]">Team Member</th>
                {months.map(m => (
                  <th key={m} className="table-header text-center min-w-[100px]">
                    {new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]) - 1).toLocaleString('en-US', { month: 'short' })}
                  </th>
                ))}
                <th className="table-header text-right min-w-[120px]">Annual</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const annual = months.reduce((sum, m) => {
                  const t = getTarget(user.id, m)
                  return sum + (t ? Number(t.nfiTargetGBP) : 0)
                }, 0)

                return (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell sticky left-0 bg-white z-10">
                      <p className="text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </td>
                    {months.map(m => {
                      const cellKey = `${user.id}-${m}`
                      const target = getTarget(user.id, m)
                      const isEditing = editingCell === cellKey

                      return (
                        <td key={m} className="table-cell text-center">
                          {isEditing ? (
                            <input
                              type="number"
                              className="input text-sm text-center w-24"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={() => saveTarget(user.id, m, editValue)}
                              onKeyDown={e => { if (e.key === 'Enter') saveTarget(user.id, m, editValue) }}
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(user.id, m)}
                              className="text-sm hover:bg-brand-50 px-2 py-1 rounded w-full"
                            >
                              {target ? formatCurrency(Number(target.nfiTargetGBP)) : '-'}
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className="table-cell text-right">
                      <span className="text-sm font-semibold">{formatCurrency(annual)}</span>
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
