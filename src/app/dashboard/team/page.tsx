'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  jobTitle: string | null
  department: string | null
  startDate: string | null
  manager: { id: string; name: string } | null
  managerId: string | null
  salesforceUserId: string | null
  _count: { directReports: number; planAssignments: number }
  totalPaidCommission?: number
  totalPaidBonus?: number
  totalEarnings?: number
}

interface Plan {
  id: string
  name: string
}

const DEPARTMENTS = ['Recruitment', 'Account Management', 'Business Development', 'Leadership', 'Operations']

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
type ViewMode = 'table' | 'orgchart'

interface EditForm {
  name: string
  email: string
  role: string
  jobTitle: string
  department: string
  managerId: string
  startDate: string
  isActive: boolean
  salesforceUserId: string
}

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
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // Edit slide-out
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    name: '', email: '', role: 'REP', jobTitle: '', department: '',
    managerId: '', startDate: '', isActive: true, salesforceUserId: '',
  })
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editWarnings, setEditWarnings] = useState<string[]>([])
  const slideRef = useRef<HTMLDivElement>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkManagerId, setBulkManagerId] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

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
    return <span className="text-brand-600 ml-1">{sortOrder === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  // ─── Edit slide-out ──────────────────────────────────────────
  function openEdit(member: TeamMember) {
    setEditingMember(member)
    setEditForm({
      name: member.name,
      email: member.email,
      role: member.role,
      jobTitle: member.jobTitle || '',
      department: member.department || '',
      managerId: member.managerId || '',
      startDate: member.startDate ? member.startDate.split('T')[0] : '',
      isActive: member.isActive,
      salesforceUserId: member.salesforceUserId || '',
    })
    setEditError(null)
    setEditWarnings([])
  }

  function closeEdit() {
    setEditingMember(null)
    setEditError(null)
    setEditWarnings([])
  }

  async function saveEdit() {
    if (!editingMember) return
    setSaving(true)
    setEditError(null)
    setEditWarnings([])

    try {
      const res = await fetch(`/api/users/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          jobTitle: editForm.jobTitle || null,
          department: editForm.department || null,
          managerId: editForm.managerId || null,
          startDate: editForm.startDate || null,
          isActive: editForm.isActive,
          salesforceUserId: editForm.salesforceUserId || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setEditError(data.error || 'Failed to save')
        setSaving(false)
        return
      }

      if (data.warnings && data.warnings.length > 0) {
        setEditWarnings(data.warnings)
      }

      closeEdit()
      loadData()
    } catch {
      setEditError('Network error')
    }
    setSaving(false)
  }

  // ─── Bulk reassign ──────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(members.map(m => m.id)))
    }
  }

  async function bulkReassign() {
    if (!bulkManagerId || selectedIds.size === 0) return
    setBulkSaving(true)
    const promises = Array.from(selectedIds).map(id =>
      fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId: bulkManagerId }),
      })
    )
    await Promise.all(promises)
    setSelectedIds(new Set())
    setBulkManagerId('')
    setBulkSaving(false)
    loadData()
  }

  // ─── Org chart helpers ────────────────────────────────────────
  function buildTree() {
    const roots: TeamMember[] = []
    const childMap: Record<string, TeamMember[]> = {}

    for (const m of members) {
      const pid = m.managerId || '__root__'
      if (!childMap[pid]) childMap[pid] = []
      childMap[pid].push(m)
    }

    // Roots are members whose managerId is null or whose manager is not in the filtered list
    const memberIds = new Set(members.map(m => m.id))
    for (const m of members) {
      if (!m.managerId || !memberIds.has(m.managerId)) {
        roots.push(m)
      }
    }

    return { roots, childMap }
  }

  function OrgNode({ member, childMap, depth }: { member: TeamMember; childMap: Record<string, TeamMember[]>; depth: number }) {
    const children = childMap[member.id] || []
    const roleBg = member.role === 'ADMIN' ? 'bg-purple-50 border-purple-200' : member.role === 'MANAGER' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
    const roleText = member.role === 'ADMIN' ? 'text-purple-600' : member.role === 'MANAGER' ? 'text-blue-600' : 'text-gray-600'

    return (
      <div className={depth > 0 ? 'ml-8 border-l-2 border-gray-200 pl-4' : ''}>
        <div
          className={`${roleBg} border rounded-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow`}
          onClick={() => isAdmin && openEdit(member)}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
              {member.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                <span className={`text-[10px] font-semibold ${roleText}`}>{member.role}</span>
                {!member.isActive && <span className="badge-red text-[10px]">Inactive</span>}
              </div>
              <p className="text-xs text-gray-500 truncate">{member.jobTitle || member.email}</p>
            </div>
            {member._count.directReports > 0 && (
              <span className="text-xs text-gray-400">{member._count.directReports} report{member._count.directReports !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        {children.length > 0 && (
          <div>
            {children.map(child => (
              <OrgNode key={child.id} member={child} childMap={childMap} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Summary stats
  const totalMembers = members.length
  const activeMembers = members.filter(m => m.isActive).length
  const totalPaidOut = members.reduce((sum, m) => sum + (m.totalEarnings || 0), 0)

  if (loading && members.length === 0) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading team...</div></div>
  }

  const { roots, childMap } = buildTree()

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-1">{totalMembers} team members ({activeMembers} active)</p>
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode('orgchart')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'orgchart' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Org Chart
          </button>
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

      {/* Bulk action bar */}
      {isAdmin && selectedIds.size > 0 && viewMode === 'table' && (
        <div className="card p-3 mb-4 bg-brand-50 border border-brand-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className="text-sm font-medium text-brand-800">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 flex-1">
            <select
              value={bulkManagerId}
              onChange={e => setBulkManagerId(e.target.value)}
              className="input text-sm w-48"
            >
              <option value="">Move to team...</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <button
              onClick={bulkReassign}
              disabled={!bulkManagerId || bulkSaving}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {bulkSaving ? 'Moving...' : 'Move'}
            </button>
          </div>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
        </div>
      )}

      {/* ═══ Table View ═══ */}
      {viewMode === 'table' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {isAdmin && (
                    <th className="table-header w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === members.length && members.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
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
                  <th className="table-header min-w-[120px]">Department</th>
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
                    className={`border-b border-gray-50 hover:bg-gray-50 ${isAdmin ? 'cursor-pointer' : ''}`}
                    onClick={() => isAdmin && openEdit(member)}
                  >
                    {isAdmin && (
                      <td className="table-cell" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(member.id)}
                          onChange={() => toggleSelect(member.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
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
                    <td className="table-cell text-sm text-gray-600">{member.department || '-'}</td>
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
                  <tr><td colSpan={isAdmin ? 10 : 9} className="table-cell text-center text-gray-500">No team members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Org Chart View ═══ */}
      {viewMode === 'orgchart' && (
        <div className="card p-6">
          {roots.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No team members to display</p>
          ) : (
            <div className="space-y-1">
              {roots.map(root => (
                <OrgNode key={root.id} member={root} childMap={childMap} depth={0} />
              ))}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/dashboard/admin" className="btn-secondary text-sm">Admin Console &rarr;</a>
          <a href="/dashboard/plans" className="btn-secondary text-sm">Manage Plans &rarr;</a>
          <a href="/dashboard/targets" className="btn-secondary text-sm">Manage Targets &rarr;</a>
        </div>
      )}

      {/* ═══ Edit Slide-Out Panel ═══ */}
      {editingMember && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/30 z-40" onClick={closeEdit} />
          {/* Panel */}
          <div
            ref={slideRef}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-900">Edit Team Member</h2>
                <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>

              {editError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{editError}</div>
              )}
              {editWarnings.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  {editWarnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="label">Role</label>
                  <select
                    className="input"
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="REP">Rep</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {/* Job Title */}
                <div>
                  <label className="label">Job Title</label>
                  <input
                    className="input"
                    value={editForm.jobTitle}
                    onChange={e => setEditForm({ ...editForm, jobTitle: e.target.value })}
                    placeholder="e.g. Senior Recruitment Consultant"
                  />
                </div>

                {/* Department */}
                <div>
                  <label className="label">Department</label>
                  <select
                    className="input"
                    value={editForm.department}
                    onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                  >
                    <option value="">No department</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Reports To */}
                <div>
                  <label className="label">Reports To</label>
                  <select
                    className="input"
                    value={editForm.managerId}
                    onChange={e => setEditForm({ ...editForm, managerId: e.target.value })}
                  >
                    <option value="">No manager</option>
                    {members
                      .filter(m => m.id !== editingMember.id && (m.role === 'MANAGER' || m.role === 'ADMIN'))
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                      ))}
                  </select>
                </div>

                {/* Start Date */}
                <div>
                  <label className="label">Start Date</label>
                  <input
                    className="input"
                    type="date"
                    value={editForm.startDate}
                    onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <label className="label mb-0">Active</label>
                  <button
                    onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Salesforce User ID */}
                <div>
                  <label className="label">Salesforce User ID</label>
                  <input
                    className="input font-mono text-sm"
                    value={editForm.salesforceUserId}
                    onChange={e => setEditForm({ ...editForm, salesforceUserId: e.target.value })}
                    placeholder="005..."
                  />
                </div>
              </div>

              {/* Direct reports info */}
              {editingMember._count.directReports > 0 && (
                <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    This person has <strong>{editingMember._count.directReports}</strong> direct report{editingMember._count.directReports !== 1 ? 's' : ''}. Changing their role or manager may affect the team structure.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t">
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={closeEdit} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
