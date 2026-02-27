'use client'

import { useEffect, useState, useCallback } from 'react'

interface PlanComponent {
  id: string
  name: string
  type: string
  rate: number
  isPercentage: boolean
  minValue: number | null
  maxValue: number | null
  tier: number | null
  accountFilter: string | null
  kickerThreshold: number | null
  isActive: boolean
}

interface Assignment {
  id: string
  user: { id: string; name: string; email: string }
  components: { id: string; name: string }[]
  startDate: string
  endDate: string | null
}

interface Plan {
  id: string
  name: string
  description: string
  fiscalYear: string
  currency: string
  isActive: boolean
  components: PlanComponent[]
  assignments: Assignment[]
  _count: { assignments: number }
}

const componentTypes = [
  { value: 'PLACEMENT_PERM', label: 'Permanent Placements' },
  { value: 'PLACEMENT_CONTRACT', label: 'Contract Placements' },
  { value: 'TIMESHEET', label: 'Timesheets' },
  { value: 'BONUS_FLAT', label: 'Flat Bonus' },
  { value: 'KICKER', label: 'Kicker' },
  { value: 'OVERRIDE', label: 'Manager Override' },
]

const emptyCompForm = { name: '', type: 'PLACEMENT_PERM', rate: '', isPercentage: true, minValue: '', maxValue: '', tier: '', accountFilter: '', kickerThreshold: '' }

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editingCompId, setEditingCompId] = useState<string | null>(null)
  const [cloningPlanId, setCloningPlanId] = useState<string | null>(null)
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([])

  // Form states
  const [planForm, setPlanForm] = useState({ name: '', description: '', fiscalYear: String(new Date().getFullYear()), currency: 'GBP' })
  const [compForm, setCompForm] = useState(emptyCompForm)
  const [assignForm, setAssignForm] = useState({ userId: '', startDate: '', endDate: '' })
  const [cloneForm, setCloneForm] = useState({ newName: '', newFiscalYear: '' })

  const loadPlans = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/plans')
    const data = await res.json()
    setPlans(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { loadPlans() }, [loadPlans])

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : []))
  }, [])

  const plan = plans.find(p => p.id === selectedPlan)

  async function createPlan() {
    await fetch('/api/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planForm),
    })
    setShowCreatePlan(false)
    setPlanForm({ name: '', description: '', fiscalYear: String(new Date().getFullYear()), currency: 'GBP' })
    loadPlans()
  }

  function startEditPlan(p: Plan) {
    setEditingPlanId(p.id)
    setPlanForm({ name: p.name, description: p.description, fiscalYear: p.fiscalYear, currency: p.currency })
  }

  async function saveEditPlan() {
    if (!editingPlanId) return
    await fetch(`/api/plans/${editingPlanId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planForm),
    })
    setEditingPlanId(null)
    setPlanForm({ name: '', description: '', fiscalYear: String(new Date().getFullYear()), currency: 'GBP' })
    loadPlans()
  }

  async function togglePlanActive(p: Plan) {
    await fetch(`/api/plans/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive }),
    })
    loadPlans()
  }

  async function addComponent() {
    if (!selectedPlan) return
    await fetch(`/api/plans/${selectedPlan}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...compForm,
        rate: compForm.rate,
        minValue: compForm.minValue || undefined,
        maxValue: compForm.maxValue || undefined,
        tier: compForm.tier || undefined,
        accountFilter: compForm.accountFilter || undefined,
        kickerThreshold: compForm.kickerThreshold || undefined,
      }),
    })
    setShowAddComponent(false)
    setCompForm(emptyCompForm)
    loadPlans()
  }

  function startEditComponent(comp: PlanComponent) {
    setEditingCompId(comp.id)
    setCompForm({
      name: comp.name,
      type: comp.type,
      rate: String(Number(comp.rate)),
      isPercentage: comp.isPercentage,
      minValue: comp.minValue !== null ? String(Number(comp.minValue)) : '',
      maxValue: comp.maxValue !== null ? String(Number(comp.maxValue)) : '',
      tier: comp.tier !== null ? String(comp.tier) : '',
      accountFilter: comp.accountFilter || '',
      kickerThreshold: comp.kickerThreshold !== null ? String(Number(comp.kickerThreshold)) : '',
    })
  }

  async function saveEditComponent() {
    if (!editingCompId || !selectedPlan) return
    await fetch(`/api/plans/${selectedPlan}/components`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        componentId: editingCompId,
        name: compForm.name,
        type: compForm.type,
        rate: compForm.rate,
        isPercentage: compForm.isPercentage,
        minValue: compForm.minValue || undefined,
        maxValue: compForm.maxValue || undefined,
        tier: compForm.tier || undefined,
        accountFilter: compForm.accountFilter || undefined,
        kickerThreshold: compForm.kickerThreshold || undefined,
      }),
    })
    setEditingCompId(null)
    setCompForm(emptyCompForm)
    loadPlans()
  }

  function cancelEditComponent() {
    setEditingCompId(null)
    setCompForm(emptyCompForm)
  }

  async function deactivateComponent(componentId: string) {
    if (!selectedPlan) return
    await fetch(`/api/plans/${selectedPlan}/components?componentId=${componentId}`, {
      method: 'DELETE',
    })
    loadPlans()
  }

  async function assignPlan() {
    if (!selectedPlan) return
    await fetch(`/api/plans/${selectedPlan}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: assignForm.userId,
        startDate: assignForm.startDate,
        endDate: assignForm.endDate || undefined,
      }),
    })
    setShowAssign(false)
    setAssignForm({ userId: '', startDate: '', endDate: '' })
    loadPlans()
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this plan? This cannot be undone.')) return
    await fetch(`/api/plans/${id}`, { method: 'DELETE' })
    setSelectedPlan(null)
    loadPlans()
  }

  function startClonePlan(p: Plan) {
    setCloningPlanId(p.id)
    // Pre-fill with next fiscal year guess
    const currentYear = new Date().getFullYear()
    const nextFY = `FY${String(currentYear).slice(2)}/${String(currentYear + 1).slice(2)}`
    setCloneForm({ newName: `${p.name} (Copy)`, newFiscalYear: p.fiscalYear || nextFY })
  }

  async function submitClonePlan() {
    if (!cloningPlanId) return
    const res = await fetch(`/api/plans/${cloningPlanId}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cloneForm),
    })
    if (res.ok) {
      const newPlan = await res.json()
      setCloningPlanId(null)
      setCloneForm({ newName: '', newFiscalYear: '' })
      await loadPlans()
      setSelectedPlan(newPlan.id)
    }
  }

  function renderComponentForm(isNew: boolean) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} placeholder="e.g. Permanent Placements" />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={compForm.type} onChange={e => setCompForm({ ...compForm, type: e.target.value })}>
              {componentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Rate (decimal, e.g. 0.10 = 10%)</label>
            <input className="input" type="number" step="0.000001" value={compForm.rate} onChange={e => setCompForm({ ...compForm, rate: e.target.value })} />
          </div>
          <div>
            <label className="label">Rate Type</label>
            <select className="input" value={compForm.isPercentage ? 'pct' : 'flat'} onChange={e => setCompForm({ ...compForm, isPercentage: e.target.value === 'pct' })}>
              <option value="pct">Percentage</option>
              <option value="flat">Flat Amount</option>
            </select>
          </div>
          <div>
            <label className="label">Min Value (tier)</label>
            <input className="input" type="number" value={compForm.minValue} onChange={e => setCompForm({ ...compForm, minValue: e.target.value })} />
          </div>
          <div>
            <label className="label">Max Value (tier)</label>
            <input className="input" type="number" value={compForm.maxValue} onChange={e => setCompForm({ ...compForm, maxValue: e.target.value })} />
          </div>
          <div>
            <label className="label">Tier Number</label>
            <input className="input" type="number" value={compForm.tier} onChange={e => setCompForm({ ...compForm, tier: e.target.value })} />
          </div>
          <div>
            <label className="label">Account Filter</label>
            <input className="input" value={compForm.accountFilter} onChange={e => setCompForm({ ...compForm, accountFilter: e.target.value })} placeholder="e.g. Mobileye" />
          </div>
          {compForm.type === 'KICKER' && (
            <div className="sm:col-span-2">
              <label className="label">Kicker Threshold (NFI)</label>
              <input className="input" type="number" value={compForm.kickerThreshold} onChange={e => setCompForm({ ...compForm, kickerThreshold: e.target.value })} />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={isNew ? addComponent : saveEditComponent} className="btn-primary text-sm">
            {isNew ? 'Add' : 'Save'}
          </button>
          <button onClick={isNew ? () => setShowAddComponent(false) : cancelEditComponent} className="btn-secondary text-sm">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading plans...</div></div>
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Plans</h1>
          <p className="text-gray-500 text-sm mt-1">{plans.length} plans configured</p>
        </div>
        <button onClick={() => setShowCreatePlan(true)} className="btn-primary">New Plan</button>
      </div>

      {/* Create Plan Form */}
      {showCreatePlan && (
        <div className="card p-6 mb-6 border-2 border-brand-200">
          <h3 className="font-semibold text-gray-900 mb-4">Create New Plan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Plan Name</label>
              <input className="input" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} placeholder="e.g. Senior Consultant - 2026" />
            </div>
            <div>
              <label className="label">Fiscal Year</label>
              <input className="input" value={planForm.fiscalYear} onChange={e => setPlanForm({ ...planForm, fiscalYear: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <input className="input" value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createPlan} className="btn-primary">Create</button>
            <button onClick={() => setShowCreatePlan(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plan list */}
        <div className="space-y-3">
          {plans.map(p => (
            <div key={p.id}>
              {editingPlanId === p.id ? (
                <div className="card p-4 border-2 border-brand-500">
                  <div className="space-y-3">
                    <div>
                      <label className="label">Plan Name</label>
                      <input className="input" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Description</label>
                      <input className="input" value={planForm.description} onChange={e => setPlanForm({ ...planForm, description: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Fiscal Year</label>
                        <input className="input" value={planForm.fiscalYear} onChange={e => setPlanForm({ ...planForm, fiscalYear: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Currency</label>
                        <input className="input" value={planForm.currency} onChange={e => setPlanForm({ ...planForm, currency: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEditPlan} className="btn-primary text-sm">Save</button>
                      <button onClick={() => setEditingPlanId(null)} className="btn-secondary text-sm">Cancel</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setSelectedPlan(p.id)}
                  className={`card p-4 cursor-pointer transition-all ${selectedPlan === p.id ? 'border-2 border-brand-500 bg-brand-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePlanActive(p) }}
                        className={p.isActive ? 'badge-green cursor-pointer' : 'badge-red cursor-pointer'}
                      >
                        {p.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditPlan(p) }}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); startClonePlan(p) }}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Clone
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{p.fiscalYear} &middot; {p.components.length} components &middot; {p._count.assignments} assigned</p>
                  {p.description && <p className="text-sm text-gray-600 mt-2">{p.description}</p>}
                  {cloningPlanId === p.id && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200" onClick={e => e.stopPropagation()}>
                      <h4 className="text-xs font-semibold text-purple-900 mb-2">Clone Plan</h4>
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">New Name</label>
                          <input className="input text-sm" value={cloneForm.newName} onChange={e => setCloneForm({ ...cloneForm, newName: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Fiscal Year</label>
                          <input className="input text-sm" value={cloneForm.newFiscalYear} onChange={e => setCloneForm({ ...cloneForm, newFiscalYear: e.target.value })} placeholder="e.g. FY27/28" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={submitClonePlan} className="btn-primary text-xs">Clone</button>
                          <button onClick={() => setCloningPlanId(null)} className="btn-secondary text-xs">Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {plans.length === 0 && (
            <div className="card p-6 text-center text-gray-500">No plans yet. Create one to get started.</div>
          )}
        </div>

        {/* Plan detail */}
        {plan ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Components */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Components</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddComponent(true); setEditingCompId(null); setCompForm(emptyCompForm) }} className="btn-primary text-sm">Add Component</button>
                  <button onClick={() => deletePlan(plan.id)} className="btn-danger text-sm">Delete Plan</button>
                </div>
              </div>

              {showAddComponent && !editingCompId && renderComponentForm(true)}

              <div className="space-y-2">
                {plan.components.filter(c => c.isActive).map(comp => (
                  editingCompId === comp.id ? (
                    <div key={comp.id}>
                      {renderComponentForm(false)}
                    </div>
                  ) : (
                    <div key={comp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{comp.name}</p>
                        <p className="text-xs text-gray-500">
                          {componentTypes.find(t => t.value === comp.type)?.label || comp.type}
                          {comp.tier !== null && ` (Tier ${comp.tier})`}
                          {comp.accountFilter && ` - ${comp.accountFilter}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {comp.isPercentage ? `${(Number(comp.rate) * 100).toFixed(1)}%` : `£${Number(comp.rate).toFixed(2)}`}
                          </p>
                          {comp.minValue !== null && (
                            <p className="text-xs text-gray-500">
                              £{Number(comp.minValue).toLocaleString()} - {comp.maxValue ? `£${Number(comp.maxValue).toLocaleString()}` : '∞'}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEditComponent(comp)}
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deactivateComponent(comp.id)}
                            className="text-xs text-red-600 hover:text-red-700 font-medium"
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                ))}
                {plan.components.filter(c => c.isActive).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No components yet. Add one above.</p>
                )}
              </div>
            </div>

            {/* Assignments */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Assigned Users</h3>
                <button onClick={() => setShowAssign(true)} className="btn-primary text-sm">Assign User</button>
              </div>

              {showAssign && (
                <div className="p-4 bg-gray-50 rounded-lg mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">User</label>
                      <select className="input" value={assignForm.userId} onChange={e => setAssignForm({ ...assignForm, userId: e.target.value })}>
                        <option value="">Select user...</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Start Date</label>
                      <input className="input" type="date" value={assignForm.startDate} onChange={e => setAssignForm({ ...assignForm, startDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">End Date (optional)</label>
                      <input className="input" type="date" value={assignForm.endDate} onChange={e => setAssignForm({ ...assignForm, endDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={assignPlan} className="btn-primary text-sm">Assign</button>
                    <button onClick={() => setShowAssign(false)} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {plan.assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{a.user.name}</p>
                      <p className="text-xs text-gray-500">{a.user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {new Date(a.startDate).toLocaleDateString()} - {a.endDate ? new Date(a.endDate).toLocaleDateString() : 'Ongoing'}
                      </p>
                      <p className="text-xs text-gray-500">{a.components.length} components</p>
                    </div>
                  </div>
                ))}
                {plan.assignments.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No users assigned yet.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 card p-8 text-center text-gray-500">
            Select a plan to view details
          </div>
        )}
      </div>
    </div>
  )
}
