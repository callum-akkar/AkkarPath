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
} from 'recharts'

interface ReportEntry {
  userName: string
  userId: string
  totalGrossValue: number
  totalCommission: number
  entryCount: number
  pendingAmount: number
  approvedAmount: number
  paidAmount: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)
}

function dateToPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function ReportsPage() {
  const [period, setPeriod] = useState(dateToPeriod(new Date()))
  const [reportData, setReportData] = useState<ReportEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadReport = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/commissions?period=${period}&limit=1000`)
    const data = await res.json()
    const entries = data.entries || []

    // Aggregate by user
    const byUser = new Map<string, ReportEntry>()
    for (const entry of entries) {
      const key = entry.userId
      const existing = byUser.get(key) || {
        userName: entry.user.name,
        userId: entry.userId,
        totalGrossValue: 0,
        totalCommission: 0,
        entryCount: 0,
        pendingAmount: 0,
        approvedAmount: 0,
        paidAmount: 0,
      }
      existing.totalGrossValue += Number(entry.grossValue)
      existing.totalCommission += Number(entry.commissionAmount)
      existing.entryCount += 1
      if (entry.status === 'PENDING') existing.pendingAmount += Number(entry.commissionAmount)
      if (entry.status === 'APPROVED') existing.approvedAmount += Number(entry.commissionAmount)
      if (entry.status === 'PAID') existing.paidAmount += Number(entry.commissionAmount)
      byUser.set(key, existing)
    }

    setReportData(Array.from(byUser.values()).sort((a, b) => b.totalCommission - a.totalCommission))
    setLoading(false)
  }, [period])

  useEffect(() => { loadReport() }, [loadReport])

  function downloadCSV(type: string) {
    const url = `/api/commissions/export?period=${period}&type=${type}`
    window.open(url, '_blank')
  }

  const totalCommission = reportData.reduce((s, r) => s + r.totalCommission, 0)
  const totalPending = reportData.reduce((s, r) => s + r.pendingAmount, 0)
  const totalApproved = reportData.reduce((s, r) => s + r.approvedAmount, 0)
  const totalPaid = reportData.reduce((s, r) => s + r.paidAmount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Commission reports and exports</p>
        </div>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="input" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <span className="text-sm text-gray-500">Total Commission</span>
          <p className="text-xl font-bold text-brand-600">{formatCurrency(totalCommission)}</p>
        </div>
        <div className="stat-card">
          <span className="text-sm text-gray-500">Pending</span>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPending)}</p>
        </div>
        <div className="stat-card">
          <span className="text-sm text-gray-500">Approved</span>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalApproved)}</p>
        </div>
        <div className="stat-card">
          <span className="text-sm text-gray-500">Paid</span>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
        </div>
      </div>

      {/* Export buttons */}
      <div className="card p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Export CSV</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadCSV('all')} className="btn-secondary text-sm">All Commissions</button>
          <button onClick={() => downloadCSV('placement')} className="btn-secondary text-sm">Placements Only</button>
          <button onClick={() => downloadCSV('timesheet')} className="btn-secondary text-sm">Timesheets Only</button>
          <button onClick={() => downloadCSV('payroll')} className="btn-secondary text-sm">Payroll Report</button>
          <button onClick={() => downloadCSV('paid')} className="btn-secondary text-sm">Paid Commissions</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Commission by Rep</h3>
          <div className="h-80">
            {reportData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={v => `£${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="userName" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="pendingAmount" name="Pending" fill="#f59e0b" stackId="a" />
                  <Bar dataKey="approvedAmount" name="Approved" fill="#3b82f6" stackId="a" />
                  <Bar dataKey="paidAmount" name="Paid" fill="#10b981" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No data</div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Rep</th>
                <th className="table-header text-right">Gross NFI</th>
                <th className="table-header text-right">Commission</th>
                <th className="table-header text-right">Entries</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="table-cell text-center text-gray-500">Loading...</td></tr>
              ) : reportData.length === 0 ? (
                <tr><td colSpan={4} className="table-cell text-center text-gray-500">No commission data for this period</td></tr>
              ) : (
                reportData.map(r => (
                  <tr key={r.userId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell text-sm font-medium">{r.userName}</td>
                    <td className="table-cell text-right text-sm">{formatCurrency(r.totalGrossValue)}</td>
                    <td className="table-cell text-right text-sm font-semibold text-brand-600">{formatCurrency(r.totalCommission)}</td>
                    <td className="table-cell text-right text-sm">{r.entryCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
