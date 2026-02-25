'use client'

import { useEffect, useState, useCallback } from 'react'

interface Plan {
  id: string
  name: string
}

interface UserData {
  id: string
  name: string
  email: string
  role: string
  planId: string | null
  plan: Plan | null
  createdAt: string
  _count: { deals: number; commissions: number }
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: 'badge-blue',
    manager: 'badge-green',
    rep: 'badge-gray',
  }
  return (
    <span className={styles[role] || 'badge-gray'}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}

export default function TeamPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('rep')
  const [formPlanId, setFormPlanId] = useState('')

  const loadData = useCallback(async () => {
    const [usersRes, plansRes] = await Promise.all([
      fetch('/api/users'),
      fetch('/api/plans'),
    ])
    const usersData = await usersRes.json()
    const plansData = await plansRes.json()
    setUsers(usersData.users || [])
    setPlans(plansData.plans || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function openNewForm() {
    setEditingUser(null)
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('rep')
    setFormPlanId('')
    setShowForm(true)
  }

  function openEditForm(user: UserData) {
    setEditingUser(user)
    setFormName(user.name)
    setFormEmail(user.email)
    setFormPassword('')
    setFormRole(user.role)
    setFormPlanId(user.planId || '')
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (editingUser) {
      const payload: Record<string, string> = {
        name: formName,
        email: formEmail,
        role: formRole,
        planId: formPlanId,
      }
      await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
          planId: formPlanId || null,
        }),
      })
    }

    setShowForm(false)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this team member?')) return
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    loadData()
  }

  async function handleAssignPlan(userId: string, planId: string) {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: planId || null }),
    })
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading team...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage team members and assign commission plans
          </p>
        </div>
        <button onClick={openNewForm} className="btn-primary">
          + Add Member
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingUser ? 'Edit Member' : 'Add Team Member'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  placeholder="jane@akkar.com"
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="input"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                  />
                </div>
              )}
              <div>
                <label className="label">Role</label>
                <select
                  className="input"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                >
                  <option value="rep">Sales Rep</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Commission Plan</label>
                <select
                  className="input"
                  value={formPlanId}
                  onChange={(e) => setFormPlanId(e.target.value)}
                >
                  <option value="">No plan assigned</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingUser ? 'Update' : 'Add Member'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="table-header">Name</th>
              <th className="table-header">Email</th>
              <th className="table-header">Role</th>
              <th className="table-header">Commission Plan</th>
              <th className="table-header">Deals</th>
              <th className="table-header">Commissions</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-medium">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="table-cell text-gray-600">{u.email}</td>
                <td className="table-cell">
                  <RoleBadge role={u.role} />
                </td>
                <td className="table-cell">
                  <select
                    value={u.planId || ''}
                    onChange={(e) => handleAssignPlan(u.id, e.target.value)}
                    className="text-sm border border-gray-200 rounded-md px-2 py-1"
                  >
                    <option value="">No plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="table-cell text-gray-600">{u._count.deals}</td>
                <td className="table-cell text-gray-600">{u._count.commissions}</td>
                <td className="table-cell text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEditForm(u)}
                      className="text-brand-600 hover:text-brand-800 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
