'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  hasFilter: boolean
  filterLabel: string | null
  filteredUserCount: number
}

interface UserOption {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  managerId: string | null
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

const DEPARTMENTS = ['Recruitment', 'Account Management', 'Business Development', 'Leadership']
const ROLES = ['ADMIN', 'MANAGER', 'REP'] as const

function DashboardContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserOption[]>([])
  const [personSearch, setPersonSearch] = useState('')
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false)

  // Read filters from URL
  const filterUserId = searchParams.get('userId') || ''
  const filterManagerId = searchParams.get('managerId') || ''
  const filterDepartment = searchParams.get('department') || ''
  const filterRole = searchParams.get('role') || ''

  const hasAnyFilter = !!(filterUserId || filterManagerId || filterDepartment || filterRole)
  const isPersonFilter = !!filterUserId

  const userRole = session?.user?.role
  const canFilter = userRole === 'ADMIN' || userRole === 'MANAGER'

  // Update URL params
  const setFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    if (key === 'userId' && value) {
      params.delete('managerId')
      params.delete('department')
      params.delete('role')
    }
    router.push(`/dashboard?${params.toString()}`)
  }, [searchParams, router])

  const clearAllFilters = useCallback(() => {
    router.push('/dashboard')
  }, [router])

  // Fetch users for filter dropdowns
  useEffect(() => {
    if (!canFilter) return
    fetch('/api/users?sort=name&order=asc')
      .then(res => res.json())
      .then(list => {
        if (Array.isArray(list)) {
          setUsers(list.map((u: Record<string, unknown>) => ({
            id: u.id as string,
            name: u.name as string,
            email: u.email as string,
            role: u.role as string,
            department: (u.department as string) || null,
            managerId: (u.managerId as string) || null,
          })))
        }
      })
      .catch(() => {})
  }, [canFilter])

  // Fetch dashboard data when filters change
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterUserId) params.set('userId', filterUserId)
    if (filterManagerId) params.set('managerId', filterManagerId)
    if (filterDepartment) params.set('department', filterDepartment)
    if (filterRole) params.set('role', filterRole)

    const qs = params.toString()
    fetch(`/api/dashboard${qs ? `?${qs}` : ''}`)
      .then(res => res.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [filterUserId, filterManagerId, filterDepartment, filterRole])

  // Close person dropdown on outside click
  useEffect(() => {
    if (!personDropdownOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-person-dropdown]')) {
        setPersonDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [personDropdownOpen])

  const managers = useMemo(() => users.filter(u => u.role === 'MANAGER'), [users])

  const filteredPersonOptions = useMemo(() => {
    if (!personSearch) return users.slice(0, 20)
    const q = personSearch.toLowerCase()
    return users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [users, personSearch])

  const selectedPersonName = useMemo(() => {
    if (!filterUserId) return ''
    return users.find(u => u.id === filterUserId)?.name || ''
  }, [filterUserId, users])

  const pageTitle = data?.filterLabel ? `Dashboard — ${data.filterLabel}` : 'Dashboard'
  const chartTitle = data?.filterLabel ? `Quarterly Performance — ${data.filterLabel}` : 'Quarterly NFI vs Target'

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    {
      label: 'Total NFI',
      value: formatCurrency(data.totalRevenue),
      sub: `${data.closedWonDeals} placements invoiced`,
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
      sub: `${data.openDeals} open placements`,
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
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
        <p className="text-gray-500 text-sm mt-1">Overview for {data.currentPeriod}</p>
      </div>

      {/* ─── Filter bar (admin/manager only) ─────────────────────── */}
      {canFilter && (
        <div className={`card p-4 mb-6 ${hasAnyFilter ? 'ring-2 ring-brand-300' : ''}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Person selector */}
            <div className="relative" data-person-dropdown="">
              <label className="block text-xs font-medium text-gray-500 mb-1">Person</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={personDropdownOpen ? personSearch : selectedPersonName}
                  onChange={(e) => {
                    setPersonSearch(e.target.value)
                    if (!personDropdownOpen) setPersonDropdownOpen(true)
                  }}
                  onFocus={() => {
                    setPersonDropdownOpen(true)
                    setPersonSearch('')
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                    filterUserId ? 'border-brand-400 bg-brand-50' : 'border-gray-300'
                  }`}
                />
                {filterUserId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setFilter('userId', '')
                      setPersonSearch('')
                      setPersonDropdownOpen(false)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              {personDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredPersonOptions.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setFilter('userId', u.id)
                        setPersonDropdownOpen(false)
                        setPersonSearch('')
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                        u.id === filterUserId ? 'bg-brand-50' : ''
                      }`}
                    >
                      <span className="font-medium text-gray-900">{u.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'MANAGER' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{u.role}</span>
                    </button>
                  ))}
                  {filteredPersonOptions.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
                  )}
                </div>
              )}
            </div>

            {/* Team selector */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Team</label>
              <select
                value={filterManagerId}
                onChange={(e) => setFilter('managerId', e.target.value)}
                disabled={isPersonFilter}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                  filterManagerId ? 'border-brand-400 bg-brand-50' : 'border-gray-300'
                } ${isPersonFilter ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">All Teams</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}&apos;s Team</option>
                ))}
              </select>
            </div>

            {/* Department selector */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilter('department', e.target.value)}
                disabled={isPersonFilter}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                  filterDepartment ? 'border-brand-400 bg-brand-50' : 'border-gray-300'
                } ${isPersonFilter ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">All Departments</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Role filter */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilter('role', e.target.value)}
                disabled={isPersonFilter}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                  filterRole ? 'border-brand-400 bg-brand-50' : 'border-gray-300'
                } ${isPersonFilter ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="">All Roles</option>
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Filter summary + clear */}
          {hasAnyFilter && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Showing:</span>{' '}
                {data.filterLabel || 'Filtered view'}{' '}
                <span className="text-gray-400">&middot; {data.filteredUserCount} {data.filteredUserCount === 1 ? 'person' : 'people'}</span>
              </p>
              <button
                onClick={clearAllFilters}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quota attainment */}
      {data.currentQuota > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">Quarterly Target Attainment</h3>
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
        </div>
      )}

      {/* Stat cards */}
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

      {/* Chart + Top performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{chartTitle}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'quota' ? 'Target' : name === 'revenue' ? 'NFI' : 'Commissions',
                  ]}
                />
                <Legend />
                <Bar dataKey="revenue" name="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="commissions" name="commissions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="quota" name="quota" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top Performers{data.hasFilter && data.filterLabel ? ` — ${data.filterLabel}` : ''}
          </h3>
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
                    <span className={`text-xs font-semibold ${rep.attainment >= 1 ? 'text-emerald-600' : rep.attainment >= 0.75 ? 'text-amber-600' : 'text-red-500'}`}>
                      {formatPct(rep.attainment)}
                    </span>
                  )}
                </div>
                {rep.attainment > 0 && (
                  <div className="ml-11 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${rep.attainment >= 1 ? 'bg-emerald-500' : rep.attainment >= 0.75 ? 'bg-amber-500' : 'bg-red-400'}`}
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

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
