'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  jobTitle: string | null
  startDate: string | null
  manager: { id: string; name: string } | null
  managerId: string | null
  _count: { directReports: number; planAssignments: number }
  totalPaidCommission?: number
  totalPaidBonus?: number
  totalEarnings?: number
}

interface Plan {
  id: string
  name: string
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)
}

function calculateTenure(startDate: string | null): string {
  if (!startDate) return '-'
  const start = new Date(startDate)
  const now = new Date()
  const diffMs = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'Not started'
  const years = Math.floor(diffDays / 365)
  const months = Math.floor((diffDays % 365) / 30)
  if (years > 0) return `${years}y ${months}m`
  if (months > 0) return `${months}m`
  return `${diffDays}d`
}

type SortField = 'name' | 'role' | 'startDate' | 'totalEarnings'

export default function TeamPage() {
  const { data: session } = useSession()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [planFilter, setPlanFilter] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const isAdmin = session?.user?.role === 'ADMIN'

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (roleFilter) params.set('role', roleFilter)
    if (managerFilter) params.set('managerId', managerFilter)
    if (planFilter) params.set('planId', planFilter)
    params.set('sort', sortField)
    params.set('order', sortOrder)

    const [usersRes, plansRes] = await Promise.all([
      fetch(`/api/users?${params}`),
      fetch('/api/plans'),
    ])
    const usersData = await usersRes.json()
    const plansData = await plansRes.json()
    setMembers(Array.isArray(usersData) ? usersData : [])
    setPlans(Array.isArray(plansData) ? plansData : [])
    setLoading(false)
  }, [search, roleFilter, managerFilter, planFilter, sortField, sortOrder])

  useEffect(() => { loadData() }, [loadData])

  // Get unique managers for filter
  const managers = members.filter(m => m.role === 'MANAGER' || m.role === 'ADMIN')

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">&uarr;&darr;</span>
    return <span className="text-brand-600 ml-1">{sortOrder === 'asc' ? '&uarr;' : '&darr;'}</span>
  }

  // Summary stats
  const totalMembers = members.length
  const activeMembers = members.filter(m => m.isActive).length
  const totalPaidOut = members.reduce((sum, m) => sum + (m.totalEarnings || 0), 0)

  if (loading && members.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading team...</div></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-1">{totalMembers} team members ({activeMembers} active)</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <span className="text-sm text-gray-500">Total Members</span>
          <p className="text-xl font-bold text-gray-900">{totalMembers}</p>
        </div>
        <div className="stat-card">
          <span className="text-sm text-gray-500">Active</span>
          <p className="text-xl font-bold text-emerald-600">{activeMembers}</p>
        </div>
        <div className="stat-card">
          <span className="text-sm text-gray-500">Total Paid Out</span>
          <p className="text-xl font-bold text-brand-600">{formatCurrency(totalPaidOut)}</p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Search by name, email, or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-sm lg:col-span-2"
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input text-sm">
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Manager</option>
            <option value="REP">Rep</option>
          </select>
          <select value={managerFilter} onChange={e => setManagerFilter(e.target.value)} className="input text-sm">
            <option value="">All Managers</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="input text-sm">
            <option value="">All Plans</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header sticky left-0 bg-white z-10 min-w-[200px]">
                  <button onClick={() => handleSort('name')} className="flex items-center">
                    Name <SortIcon field="name" />
                  </button>
                </th>
                <th className="table-header min-w-[100px]">
                  <button onClick={() => handleSort('role')} className="flex items-center">
                    Role <SortIcon field="role" />
                  </button>
                </th>
                <th className="table-header min-w-[140px]">Title</th>
                <th className="table-header min-w-[120px]">Manager</th>
                <th className="table-header min-w-[120px]">
                  <button onClick={() => handleSort('startDate')} className="flex items-center">
                    Start Date <SortIcon field="startDate" />
                  </button>
                </th>
                <th className="table-header text-center min-w-[80px]">Plans</th>
                <th className="table-header text-right min-w-[120px]">
                  <button onClick={() => handleSort('totalEarnings')} className="flex items-center justify-end">
                    Total Paid <SortIcon field="totalEarnings" />
                  </button>
                </th>
                <th className="table-header min-w-[80px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr
                  key={member.id}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="table-cell sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className={`text-xs font-medium ${member.role === 'ADMIN' ? 'text-purple-600' : member.role === 'MANAGER' ? 'text-blue-600' : 'text-gray-600'}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="table-cell text-sm text-gray-600">{member.jobTitle || '-'}</td>
                  <td className="table-cell text-sm text-gray-600">{member.manager?.name || '-'}</td>
                  <td className="table-cell">
                    {member.startDate ? (
                      <div>
                        <p className="text-sm text-gray-900">{new Date(member.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p className="text-xs text-gray-500">{calculateTenure(member.startDate)}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="table-cell text-center text-sm">{member._count.planAssignments}</td>
                  <td className="table-cell text-right">
                    {member.totalEarnings !== undefined ? (
                      <span className="text-sm font-semibold text-brand-600">{formatCurrency(member.totalEarnings)}</span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="table-cell">
                    <span className={member.isActive ? 'badge-green' : 'badge-red'}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {members.length === 0 && !loading && (
                <tr><td colSpan={8} className="table-cell text-center text-gray-500">No team members found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/dashboard/admin" className="btn-secondary text-sm">Manage Users &rarr;</a>
          <a href="/dashboard/plans" className="btn-secondary text-sm">Manage Plans &rarr;</a>
          <a href="/dashboard/targets" className="btn-secondary text-sm">Manage Targets &rarr;</a>
        </div>
      )}
    </div>
  )
}
