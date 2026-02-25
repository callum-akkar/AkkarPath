'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts'

interface EarningsStep {
  attainmentPct: number
  revenue: number
  commission: number
  baseSalary: number
  totalEarnings: number
}

interface Projection {
  ytdActual: number
  annualQuota: number
  pipelineTotal: number
  monthlyRate: number
  projectedYear: number
  ytdAttainment: number
  projectedAttainment: number
  ote: number
  baseSalary: number
  currentMonth: number
  plan: {
    id: string
    name: string
    planType: string
    ote: number
    baseSalary: number
    quotaAmount: number
  } | null
}

interface RampPeriod {
  month: number
  quotaPct: number
  commissionPct: number
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
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export default function PathsPage() {
  const [projection, setProjection] = useState<Projection | null>(null)
  const [earningsPath, setEarningsPath] = useState<EarningsStep[]>([])
  const [rampSchedule, setRampSchedule] = useState<RampPeriod[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [selectedRep, setSelectedRep] = useState('')
  const [loading, setLoading] = useState(true)

  const loadPath = useCallback(async (repId?: string) => {
    const params = repId ? `?repId=${repId}` : ''
    const res = await fetch(`/api/reports/paths${params}`)
    const data = await res.json()
    setProjection(data.projection)
    setEarningsPath(data.earningsPath || [])
    setRampSchedule(data.rampSchedule || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/users').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
    ]).then(([usersData, meData]) => {
      setUsers(usersData.users || [])
      setCurrentUser(meData.user || null)
      loadPath()
    })
  }, [loadPath])

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager'

  function handleRepChange(repId: string) {
    setSelectedRep(repId)
    setLoading(true)
    loadPath(repId || undefined)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading compensation path...</div>
      </div>
    )
  }

  if (!projection?.plan) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Compensation Path</h1>
        <div className="card p-12 text-center">
          <p className="text-gray-500 text-lg">No commission plan assigned.</p>
          <p className="text-gray-400 text-sm mt-2">
            {isAdmin
              ? 'Assign a plan with OTE and quota in the Plans and Team pages.'
              : 'Ask your manager to assign you a commission plan.'}
          </p>
        </div>
      </div>
    )
  }

  const variablePay = projection.ote - projection.baseSalary
  const projectedEarnings = projection.baseSalary + (variablePay * projection.projectedAttainment)

  // Where the rep currently sits on the earnings path
  const currentAttainmentPct = Math.round(projection.projectedAttainment * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compensation Path</h1>
          <p className="text-gray-500 text-sm mt-1">
            See your earnings at every attainment level
          </p>
        </div>
        {isAdmin && (
          <select
            className="input w-48"
            value={selectedRep}
            onChange={(e) => handleRepChange(e.target.value)}
          >
            <option value="">My Path</option>
            {users
              .filter((u) => u.role === 'rep')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Plan Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Plan</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{projection.plan.name}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">OTE</p>
          <p className="text-lg font-bold text-brand-600 mt-1">{formatCurrency(projection.ote)}</p>
          <p className="text-xs text-gray-400">{formatCurrency(projection.baseSalary)} base + {formatCurrency(variablePay)} variable</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Annual Quota</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(projection.annualQuota)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">YTD Closed</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatCurrency(projection.ytdActual)}</p>
          <p className="text-xs text-gray-400">{formatPct(projection.ytdAttainment)} attainment</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Projected Year</p>
          <p className="text-lg font-bold text-purple-600 mt-1">{formatCurrency(projection.projectedYear)}</p>
          <p className="text-xs text-gray-400">{formatPct(projection.projectedAttainment)} attainment</p>
        </div>
      </div>

      {/* Attainment Progress Bar */}
      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Path to Quota</h3>
          <span className="text-sm text-gray-500">
            {formatCurrency(projection.annualQuota - projection.ytdActual)} remaining
          </span>
        </div>
        <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
          {/* YTD actual */}
          <div
            className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all"
            style={{ width: `${Math.min(projection.ytdAttainment * 100, 100)}%` }}
          />
          {/* Projected (lighter) */}
          <div
            className="absolute inset-y-0 left-0 bg-emerald-200 rounded-full transition-all -z-0"
            style={{ width: `${Math.min(projection.projectedAttainment * 100, 100)}%` }}
          />
          {/* Pipeline marker */}
          {projection.pipelineTotal > 0 && projection.annualQuota > 0 && (
            <div
              className="absolute inset-y-0 w-0.5 bg-amber-500"
              style={{
                left: `${Math.min(
                  ((projection.ytdActual + projection.pipelineTotal) / projection.annualQuota) * 100,
                  100
                )}%`,
              }}
            />
          )}
          {/* 100% marker */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <span className="text-xs font-medium text-gray-500">100%</span>
          </div>
        </div>
        <div className="flex gap-6 mt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-gray-600">YTD Closed ({formatPct(projection.ytdAttainment)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-200" />
            <span className="text-gray-600">Projected ({formatPct(projection.projectedAttainment)})</span>
          </div>
          {projection.pipelineTotal > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-gray-600">+ Pipeline ({formatCurrency(projection.pipelineTotal)})</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Earnings Curve */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Earnings Curve</h3>
          <p className="text-sm text-gray-500 mb-4">
            Total compensation at each attainment level
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsPath}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="attainmentPct"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                  label={{ value: 'Quota Attainment', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'totalEarnings' ? 'Total Earnings' : name === 'commission' ? 'Commission' : 'Base',
                  ]}
                  labelFormatter={(v) => `${v}% Attainment`}
                />
                <ReferenceLine
                  x={100}
                  stroke="#10b981"
                  strokeDasharray="5 5"
                  label={{ value: 'OTE', position: 'top', fill: '#10b981', fontSize: 11 }}
                />
                {currentAttainmentPct > 0 && (
                  <ReferenceLine
                    x={currentAttainmentPct}
                    stroke="#8b5cf6"
                    strokeDasharray="3 3"
                    label={{ value: 'You', position: 'top', fill: '#8b5cf6', fontSize: 11 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="totalEarnings"
                  stroke="#3b82f6"
                  fill="#dbeafe"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Commission Breakdown */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Earnings by Attainment</h3>
          <p className="text-sm text-gray-500 mb-4">
            Detailed breakdown at each milestone
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={earningsPath}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="attainmentPct"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'commission' ? 'Variable Pay' : name === 'baseSalary' ? 'Base Salary' : 'Revenue',
                  ]}
                  labelFormatter={(v) => `${v}% Attainment`}
                />
                <Line type="monotone" dataKey="commission" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="commission" />
                <Line type="monotone" dataKey="baseSalary" stroke="#6b7280" strokeWidth={1} strokeDasharray="5 5" name="baseSalary" />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="revenue" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Earnings Table */}
      <div className="card overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Earnings Table</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Attainment</th>
              <th className="table-header">Revenue</th>
              <th className="table-header">Base Salary</th>
              <th className="table-header">Commission</th>
              <th className="table-header">Total Earnings</th>
              <th className="table-header">Effective Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {earningsPath.map((step) => {
              const isQuota = step.attainmentPct === 100
              const isCurrent =
                currentAttainmentPct >= step.attainmentPct &&
                currentAttainmentPct < (earningsPath[earningsPath.indexOf(step) + 1]?.attainmentPct ?? 999)

              return (
                <tr
                  key={step.attainmentPct}
                  className={`${isQuota ? 'bg-emerald-50 font-semibold' : ''} ${
                    isCurrent ? 'bg-purple-50' : ''
                  } hover:bg-gray-50`}
                >
                  <td className="table-cell">
                    {step.attainmentPct}%
                    {isQuota && <span className="ml-2 badge-green">OTE</span>}
                    {isCurrent && <span className="ml-2 badge bg-purple-100 text-purple-700">Current</span>}
                  </td>
                  <td className="table-cell">{formatCurrency(step.revenue)}</td>
                  <td className="table-cell text-gray-600">{formatCurrency(step.baseSalary)}</td>
                  <td className="table-cell text-amber-600 font-medium">{formatCurrency(step.commission)}</td>
                  <td className="table-cell text-brand-600 font-bold">{formatCurrency(step.totalEarnings)}</td>
                  <td className="table-cell text-gray-500">
                    {step.revenue > 0 ? formatPct(step.commission / step.revenue) : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Projected Earnings Summary */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Projected Annual Earnings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500">Base Salary</p>
            <p className="text-lg font-bold text-gray-700">{formatCurrency(projection.baseSalary)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Projected Variable</p>
            <p className="text-lg font-bold text-amber-600">
              {formatCurrency(projectedEarnings - projection.baseSalary)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Projected Total</p>
            <p className="text-lg font-bold text-brand-600">{formatCurrency(projectedEarnings)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">vs OTE</p>
            <p className={`text-lg font-bold ${projectedEarnings >= projection.ote ? 'text-emerald-600' : 'text-red-500'}`}>
              {projectedEarnings >= projection.ote ? '+' : ''}{formatCurrency(projectedEarnings - projection.ote)}
            </p>
          </div>
        </div>
      </div>

      {/* Ramp Schedule if applicable */}
      {rampSchedule.length > 0 && (
        <div className="card p-6 mt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Ramp Schedule</h3>
          <p className="text-sm text-gray-500 mb-4">
            Reduced quota and commission targets during onboarding
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {rampSchedule.map((r) => (
              <div key={r.month} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Month {r.month}</p>
                <p className="text-sm font-medium text-gray-900">
                  {(r.quotaPct * 100).toFixed(0)}% quota
                </p>
                <p className="text-xs text-brand-600">
                  {(r.commissionPct * 100).toFixed(0)}% commission
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
