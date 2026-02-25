'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  Cell,
} from 'recharts'

interface MonthlyAttainment {
  period: string
  month: number
  monthLabel: string
  target: number
  actual: number
  attainment: number
  gap: number
  dealCount: number
  commissions: number
}

interface RepReport {
  rep: { id: string; name: string; email: string }
  monthly: MonthlyAttainment[]
  ytd: {
    target: number
    actual: number
    attainment: number
    gap: number
    commissions: number
  }
}

interface PayoutData {
  rep: { id: string; name: string; email: string }
  monthly: { period: string; month: number; pending: number; approved: number; paid: number; total: number }[]
  totals: { pending: number; approved: number; paid: number; total: number }
}

interface User {
  id: string
  name: string
  role: string
}

type Tab = 'attainment' | 'payout'

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('attainment')
  const [reports, setReports] = useState<RepReport[]>([])
  const [payoutData, setPayoutData] = useState<PayoutData[]>([])
  const [teamTotals, setTeamTotals] = useState({ pending: 0, approved: 0, paid: 0, total: 0 })
  const [users, setUsers] = useState<User[]>([])
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [selectedRep, setSelectedRep] = useState('')
  const [loading, setLoading] = useState(true)

  const loadAttainment = useCallback(async () => {
    const params = new URLSearchParams({ year })
    if (selectedRep) params.set('repId', selectedRep)
    const res = await fetch(`/api/reports/attainment?${params}`)
    const data = await res.json()
    setReports(data.reports || [])
  }, [year, selectedRep])

  const loadPayout = useCallback(async () => {
    const res = await fetch(`/api/reports/payout?year=${year}`)
    const data = await res.json()
    setPayoutData(data.payoutData || [])
    setTeamTotals(data.teamTotals || { pending: 0, approved: 0, paid: 0, total: 0 })
  }, [year])

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users || [])
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!loading) {
      if (tab === 'attainment') loadAttainment()
      else loadPayout()
    }
  }, [loading, tab, loadAttainment, loadPayout])

  function handleExportAttainment() {
    const headers = ['Rep', 'Month', 'Quota Target', 'Actual Revenue', 'Attainment %', 'Gap', 'Deals', 'Commissions']
    const rows: string[][] = []
    for (const report of reports) {
      for (const m of report.monthly) {
        rows.push([
          report.rep.name,
          m.period,
          m.target.toString(),
          m.actual.toString(),
          (m.attainment * 100).toFixed(1) + '%',
          m.gap.toString(),
          m.dealCount.toString(),
          m.commissions.toString(),
        ])
      }
    }
    exportCSV(headers, rows, `attainment-report-${year}.csv`)
  }

  function handleExportPayout() {
    const headers = ['Rep', 'Month', 'Pending', 'Approved', 'Paid', 'Total']
    const rows: string[][] = []
    for (const pd of payoutData) {
      for (const m of pd.monthly) {
        if (m.total > 0) {
          rows.push([
            pd.rep.name,
            m.period,
            m.pending.toString(),
            m.approved.toString(),
            m.paid.toString(),
            m.total.toString(),
          ])
        }
      }
    }
    exportCSV(headers, rows, `payout-report-${year}.csv`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">
            Attainment tracking and payout reports
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
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
          <button
            onClick={tab === 'attainment' ? handleExportAttainment : handleExportPayout}
            className="btn-secondary"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('attainment')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'attainment' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Quota Attainment
        </button>
        <button
          onClick={() => setTab('payout')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'payout' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Payout Summary
        </button>
      </div>

      {tab === 'attainment' && (
        <AttainmentReport
          reports={reports}
          users={users}
          selectedRep={selectedRep}
          onRepChange={setSelectedRep}
          year={year}
        />
      )}

      {tab === 'payout' && (
        <PayoutReport payoutData={payoutData} teamTotals={teamTotals} />
      )}
    </div>
  )
}

function AttainmentReport({
  reports,
  users,
  selectedRep,
  onRepChange,
  year,
}: {
  reports: RepReport[]
  users: User[]
  selectedRep: string
  onRepChange: (v: string) => void
  year: string
}) {
  // Team-level chart data
  const currentMonth = new Date().getMonth() + 1
  const chartData = MONTHS.slice(0, currentMonth).map((label, idx) => {
    const month = idx + 1
    let totalTarget = 0
    let totalActual = 0

    for (const report of reports) {
      const m = report.monthly.find((m) => m.month === month)
      if (m) {
        totalTarget += m.target
        totalActual += m.actual
      }
    }

    return {
      month: label,
      target: totalTarget,
      actual: totalActual,
      attainment: totalTarget > 0 ? totalActual / totalTarget : 0,
    }
  })

  return (
    <div>
      {/* Filter */}
      <div className="mb-6">
        <select
          className="input w-48"
          value={selectedRep}
          onChange={(e) => onRepChange(e.target.value)}
        >
          <option value="">All Reps</option>
          {users
            .filter((u) => u.role === 'rep')
            .map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
        </select>
      </div>

      {/* Chart */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Monthly Quota vs. Actual</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="target" name="Quota" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Revenue" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.attainment >= 1 ? '#10b981' : entry.attainment >= 0.75 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attainment trend */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Attainment Trend</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip formatter={(value: number) => formatPct(value)} />
              <Line type="monotone" dataKey="attainment" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rep Cards */}
      <h3 className="font-semibold text-gray-900 mb-4">Rep Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {reports.map((report) => {
          const a = report.ytd.attainment
          const color = a >= 1 ? 'emerald' : a >= 0.75 ? 'amber' : 'red'

          return (
            <div key={report.rep.id} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                  {report.rep.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{report.rep.name}</p>
                  <p className="text-xs text-gray-500">{report.rep.email}</p>
                </div>
              </div>

              {/* Attainment bar */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">YTD Attainment</span>
                  <span className={`font-bold text-${color}-600`}>{formatPct(a)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-${color}-500`}
                    style={{ width: `${Math.min(a * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Quota</p>
                  <p className="font-semibold">{formatCurrency(report.ytd.target)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Revenue</p>
                  <p className="font-semibold">{formatCurrency(report.ytd.actual)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Gap</p>
                  <p className={`font-semibold ${report.ytd.gap > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {report.ytd.gap > 0 ? '-' : '+'}{formatCurrency(Math.abs(report.ytd.gap))}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Commissions</p>
                  <p className="font-semibold text-brand-600">{formatCurrency(report.ytd.commissions)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail Table */}
      {reports.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">Monthly Detail</h3>
          </div>
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Rep</th>
                <th className="table-header">Month</th>
                <th className="table-header text-right">Quota</th>
                <th className="table-header text-right">Revenue</th>
                <th className="table-header text-right">Attainment</th>
                <th className="table-header text-right">Gap</th>
                <th className="table-header text-right">Deals</th>
                <th className="table-header text-right">Commissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.flatMap((report) =>
                report.monthly
                  .filter((m) => m.target > 0 || m.actual > 0)
                  .map((m) => (
                    <tr key={`${report.rep.id}-${m.period}`} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{report.rep.name}</td>
                      <td className="table-cell">{m.monthLabel} {year}</td>
                      <td className="table-cell text-right">{formatCurrency(m.target)}</td>
                      <td className="table-cell text-right">{formatCurrency(m.actual)}</td>
                      <td className="table-cell text-right">
                        <span
                          className={`font-semibold ${
                            m.attainment >= 1
                              ? 'text-emerald-600'
                              : m.attainment >= 0.75
                              ? 'text-amber-600'
                              : 'text-red-500'
                          }`}
                        >
                          {formatPct(m.attainment)}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <span className={m.gap > 0 ? 'text-red-500' : 'text-emerald-600'}>
                          {m.gap > 0 ? '-' : '+'}{formatCurrency(Math.abs(m.gap))}
                        </span>
                      </td>
                      <td className="table-cell text-right">{m.dealCount}</td>
                      <td className="table-cell text-right text-brand-600 font-medium">
                        {formatCurrency(m.commissions)}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {reports.length === 0 && (
        <div className="card p-12 text-center text-gray-500">
          No data found. Set quota targets and close deals to see reports.
        </div>
      )}
    </div>
  )
}

function PayoutReport({
  payoutData,
  teamTotals,
}: {
  payoutData: PayoutData[]
  teamTotals: { pending: number; approved: number; paid: number; total: number }
}) {
  return (
    <div>
      {/* Team Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <p className="text-sm text-gray-500">Total Commissions</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(teamTotals.total)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Pending</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(teamTotals.pending)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Approved</p>
          <p className="text-xl font-bold text-brand-600">{formatCurrency(teamTotals.approved)}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-gray-500">Paid</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(teamTotals.paid)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Payout by Rep</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={payoutData.map((d) => ({
                name: d.rep.name,
                pending: d.totals.pending,
                approved: d.totals.approved,
                paid: d.totals.paid,
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="paid" name="Paid" stackId="a" fill="#10b981" />
              <Bar dataKey="approved" name="Approved" stackId="a" fill="#3b82f6" />
              <Bar dataKey="pending" name="Pending" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Payout Detail</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Rep</th>
              <th className="table-header text-right">Pending</th>
              <th className="table-header text-right">Approved</th>
              <th className="table-header text-right">Paid</th>
              <th className="table-header text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payoutData.map((d) => (
              <tr key={d.rep.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{d.rep.name}</td>
                <td className="table-cell text-right text-amber-600">{formatCurrency(d.totals.pending)}</td>
                <td className="table-cell text-right text-brand-600">{formatCurrency(d.totals.approved)}</td>
                <td className="table-cell text-right text-emerald-600 font-semibold">{formatCurrency(d.totals.paid)}</td>
                <td className="table-cell text-right font-bold">{formatCurrency(d.totals.total)}</td>
              </tr>
            ))}
            {/* Team total row */}
            <tr className="bg-gray-50 font-bold">
              <td className="table-cell">Team Total</td>
              <td className="table-cell text-right text-amber-600">{formatCurrency(teamTotals.pending)}</td>
              <td className="table-cell text-right text-brand-600">{formatCurrency(teamTotals.approved)}</td>
              <td className="table-cell text-right text-emerald-600">{formatCurrency(teamTotals.paid)}</td>
              <td className="table-cell text-right">{formatCurrency(teamTotals.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
