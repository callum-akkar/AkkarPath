'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from 'recharts'

interface DashboardData {
  currentPeriod: string
  totalDeals: number
  closedWonDeals: number
  openDeals: number
  totalRevenue: number
  totalCommissions: number
  pendingAmount: number
  paidAmount: number
  pipelineValue: number
  currentQuota: number
  currentRevenue: number
  attainmentPct: number
  monthlyData: { period: string; label: string; revenue: number; quota: number; commissions: number }[]
  topReps: { name: string; total: number; attainment: number }[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(data.totalRevenue),
      sub: `${data.closedWonDeals} closed deals`,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      dotColor: 'bg-emerald-600',
    },
    {
      label: 'Total Commissions',
      value: formatCurrency(data.totalCommissions),
      sub: `${formatCurrency(data.pendingAmount)} pending`,
      color: 'text-brand-600',
      bg: 'bg-brand-50',
      dotColor: 'bg-brand-600',
    },
    {
      label: 'Pipeline',
      value: formatCurrency(data.pipelineValue),
      sub: `${data.openDeals} open deals`,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      dotColor: 'bg-amber-600',
    },
    {
      label: 'Paid Out',
      value: formatCurrency(data.paidAmount),
      sub: 'Commissions paid',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      dotColor: 'bg-purple-600',
    },
  ]

  const attainmentColor =
    data.attainmentPct >= 1 ? 'emerald' : data.attainmentPct >= 0.75 ? 'amber' : 'red'

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Overview for {data.currentPeriod}
        </p>
      </div>

      {/* Quota Attainment Banner */}
      {data.currentQuota > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">
                Monthly Quota Attainment
              </h3>
              <p className="text-sm text-gray-500">
                {formatCurrency(data.currentRevenue)} of {formatCurrency(data.currentQuota)} target
              </p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-bold text-${attainmentColor}-600`}>
                {formatPct(data.attainmentPct)}
              </p>
              <p className="text-xs text-gray-500">
                {formatCurrency(Math.max(data.currentQuota - data.currentRevenue, 0))} to go
              </p>
            </div>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-${attainmentColor}-500 transition-all`}
              style={{ width: `${Math.min(data.attainmentPct * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>0%</span>
            <span>50%</span>
            <span>75%</span>
            <span className="font-semibold text-emerald-600">100%</span>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <div className={`w-3 h-3 rounded-full ${stat.dotColor}`} />
              </div>
              <span className="text-sm font-medium text-gray-500">{stat.label}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Revenue vs Quota
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'quota' ? 'Quota Target' : name === 'revenue' ? 'Revenue' : 'Commissions',
                  ]}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Legend />
                <Bar dataKey="revenue" name="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="commissions" name="commissions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="quota"
                  name="quota"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Reps</h3>
          <div className="space-y-4">
            {data.topReps.map((rep, idx) => (
              <div key={rep.name}>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{rep.name}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(rep.total)} earned</p>
                  </div>
                  {rep.attainment > 0 && (
                    <span
                      className={`text-xs font-semibold ${
                        rep.attainment >= 1
                          ? 'text-emerald-600'
                          : rep.attainment >= 0.75
                          ? 'text-amber-600'
                          : 'text-red-500'
                      }`}
                    >
                      {formatPct(rep.attainment)}
                    </span>
                  )}
                </div>
                {rep.attainment > 0 && (
                  <div className="ml-11 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        rep.attainment >= 1
                          ? 'bg-emerald-500'
                          : rep.attainment >= 0.75
                          ? 'bg-amber-500'
                          : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.min(rep.attainment * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
            {data.topReps.length === 0 && (
              <p className="text-sm text-gray-500">No commission data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
