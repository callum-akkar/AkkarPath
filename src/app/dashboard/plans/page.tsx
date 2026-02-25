'use client'

import { useEffect, useState, useCallback } from 'react'

interface Tier {
  id?: string
  minAmount: number
  maxAmount: number | null
  rate: number
  orderIndex: number
}

interface Plan {
  id: string
  name: string
  description: string
  planType: string
  tiers: Tier[]
  _count: { users: number }
  createdAt: string
}

function formatPercent(rate: number) {
  return `${(rate * 100).toFixed(1)}%`
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount)
}

const planTypeLabels: Record<string, string> = {
  flat_rate: 'Flat Rate',
  tiered: 'Tiered',
  accelerator: 'Accelerator',
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPlanType, setFormPlanType] = useState('flat_rate')
  const [formTiers, setFormTiers] = useState<Tier[]>([
    { minAmount: 0, maxAmount: null, rate: 0.1, orderIndex: 0 },
  ])

  const loadPlans = useCallback(async () => {
    const res = await fetch('/api/plans')
    const data = await res.json()
    setPlans(data.plans || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  function openNewForm() {
    setEditingPlan(null)
    setFormName('')
    setFormDescription('')
    setFormPlanType('flat_rate')
    setFormTiers([{ minAmount: 0, maxAmount: null, rate: 0.1, orderIndex: 0 }])
    setShowForm(true)
  }

  function openEditForm(plan: Plan) {
    setEditingPlan(plan)
    setFormName(plan.name)
    setFormDescription(plan.description)
    setFormPlanType(plan.planType)
    setFormTiers(
      plan.tiers.length > 0
        ? plan.tiers.map((t) => ({ ...t }))
        : [{ minAmount: 0, maxAmount: null, rate: 0.1, orderIndex: 0 }]
    )
    setShowForm(true)
  }

  function addTier() {
    const lastTier = formTiers[formTiers.length - 1]
    setFormTiers([
      ...formTiers,
      {
        minAmount: lastTier?.maxAmount || 0,
        maxAmount: null,
        rate: (lastTier?.rate || 0.1) + 0.05,
        orderIndex: formTiers.length,
      },
    ])
  }

  function removeTier(index: number) {
    if (formTiers.length <= 1) return
    setFormTiers(formTiers.filter((_, i) => i !== index))
  }

  function updateTier(index: number, field: keyof Tier, value: string) {
    const updated = [...formTiers]
    if (field === 'rate') {
      updated[index].rate = parseFloat(value) / 100
    } else if (field === 'minAmount') {
      updated[index].minAmount = parseFloat(value) || 0
    } else if (field === 'maxAmount') {
      updated[index].maxAmount = value ? parseFloat(value) : null
    }
    setFormTiers(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      name: formName,
      description: formDescription,
      planType: formPlanType,
      tiers: formTiers.map((t, i) => ({
        minAmount: t.minAmount,
        maxAmount: t.maxAmount,
        rate: t.rate,
        orderIndex: i,
      })),
    }

    if (editingPlan) {
      await fetch(`/api/plans/${editingPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    setShowForm(false)
    loadPlans()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this commission plan?')) return
    await fetch(`/api/plans/${id}`, { method: 'DELETE' })
    loadPlans()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading plans...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commission Plans</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create and manage compensation structures
          </p>
        </div>
        <button onClick={openNewForm} className="btn-primary">
          + New Plan
        </button>
      </div>

      {/* Plan Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-auto py-8">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl">
            <h2 className="text-lg font-bold mb-4">
              {editingPlan ? 'Edit Plan' : 'New Commission Plan'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Plan Name</label>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Standard Sales Commission"
                  required
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Commission plan for the sales team..."
                  rows={2}
                />
              </div>
              <div>
                <label className="label">Plan Type</label>
                <select
                  className="input"
                  value={formPlanType}
                  onChange={(e) => setFormPlanType(e.target.value)}
                >
                  <option value="flat_rate">Flat Rate - Same % on every deal</option>
                  <option value="tiered">Tiered - Different % based on deal amount ranges</option>
                  <option value="accelerator">
                    Accelerator - Higher % as total volume increases
                  </option>
                </select>
              </div>

              {/* Tiers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">
                    {formPlanType === 'flat_rate' ? 'Rate' : 'Tiers'}
                  </label>
                  {formPlanType !== 'flat_rate' && (
                    <button
                      type="button"
                      onClick={addTier}
                      className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                    >
                      + Add Tier
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {formTiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      {formPlanType !== 'flat_rate' && (
                        <>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">Min ($)</label>
                            <input
                              type="number"
                              className="input mt-1"
                              value={tier.minAmount}
                              onChange={(e) =>
                                updateTier(idx, 'minAmount', e.target.value)
                              }
                              min="0"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-500">Max ($)</label>
                            <input
                              type="number"
                              className="input mt-1"
                              value={tier.maxAmount ?? ''}
                              onChange={(e) =>
                                updateTier(idx, 'maxAmount', e.target.value)
                              }
                              placeholder="No limit"
                            />
                          </div>
                        </>
                      )}
                      <div className={formPlanType === 'flat_rate' ? 'flex-1' : 'w-24'}>
                        <label className="text-xs text-gray-500">Rate (%)</label>
                        <input
                          type="number"
                          className="input mt-1"
                          value={(tier.rate * 100).toFixed(1)}
                          onChange={(e) => updateTier(idx, 'rate', e.target.value)}
                          step="0.1"
                          min="0"
                          max="100"
                          required
                        />
                      </div>
                      {formPlanType !== 'flat_rate' && formTiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTier(idx)}
                          className="text-red-500 hover:text-red-700 mt-4"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingPlan ? 'Update Plan' : 'Create Plan'}
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

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="card p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                <span className="badge-blue mt-1">{planTypeLabels[plan.planType]}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEditForm(plan)}
                  className="text-brand-600 hover:text-brand-800 text-sm font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>

            {plan.description && (
              <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
            )}

            <div className="space-y-2 mb-4">
              {plan.tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2"
                >
                  <span className="text-gray-600">
                    {plan.planType === 'flat_rate'
                      ? 'All deals'
                      : `${formatCurrency(tier.minAmount)} - ${
                          tier.maxAmount ? formatCurrency(tier.maxAmount) : 'No limit'
                        }`}
                  </span>
                  <span className="font-semibold text-brand-600">
                    {formatPercent(tier.rate)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                {plan._count.users} {plan._count.users === 1 ? 'rep' : 'reps'} assigned
              </span>
            </div>
          </div>
        ))}

        {plans.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-500">
            <p className="text-lg mb-2">No commission plans yet</p>
            <p className="text-sm">Create your first plan to start calculating commissions.</p>
          </div>
        )}
      </div>
    </div>
  )
}
