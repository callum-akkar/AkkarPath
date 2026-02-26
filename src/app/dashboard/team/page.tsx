'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  jobTitle: string | null
  manager: { id: string; name: string } | null
  _count: { directReports: number; planAssignments: number }
}

interface MemberCommissions {
  entries: Array<{
    id: string
    commissionAmount: number
    grossValue: number
    status: string
    sourceType: string
    planComponent: { name: string; type: string } | null
  }>
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(amount)
}

function dateToPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function TeamPage() {
  const { data: session } = useSession()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [memberCommissions, setMemberCommissions] = useState<MemberCommissions | null>(null)
  const [period, setPeriod] = useState(dateToPeriod(new Date()))

  useEffect(() => {
    fetch('/api/users')
      .then(res => res.json())
      .then(data => setMembers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  async function loadMemberCommissions(userId: string) {
    setSelectedMember(userId)
    const res = await fetch(`/api/commissions?userId=${userId}&period=${period}`)
    const data = await res.json()
    setMemberCommissions(data)
  }

  const isAdmin = session?.user?.role === 'ADMIN'

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading team...</div></div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm mt-1">{members.length} team members</p>
        </div>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="input" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Name</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Manager</th>
                  <th className="table-header">Plans</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map(member => (
                  <tr
                    key={member.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${selectedMember === member.id ? 'bg-brand-50' : ''}`}
                    onClick={() => loadMemberCommissions(member.id)}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-medium">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
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
                    <td className="table-cell text-sm">{member._count.planAssignments}</td>
                    <td className="table-cell">
                      <span className={member.isActive ? 'badge-green' : 'badge-red'}>
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {selectedMember && memberCommissions ? (
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Commissions for {period}
              </h3>
              {memberCommissions.entries.length === 0 ? (
                <p className="text-sm text-gray-500">No entries for this period.</p>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-brand-50 rounded-lg">
                    <p className="text-xs text-gray-500">Total Commission</p>
                    <p className="text-lg font-bold text-brand-600">
                      {formatCurrency(memberCommissions.entries.reduce((s, e) => s + Number(e.commissionAmount), 0))}
                    </p>
                  </div>
                  {memberCommissions.entries.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium">{entry.planComponent?.name || 'Manual'}</p>
                        <p className="text-xs text-gray-500">{entry.sourceType} - {entry.status}</p>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(Number(entry.commissionAmount))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card p-6 text-center text-gray-500">
              <p className="text-sm">Click a team member to view their commissions</p>
            </div>
          )}

          {isAdmin && (
            <div className="card p-6 mt-4">
              <h3 className="font-semibold text-gray-900 mb-2">Quick Actions</h3>
              <div className="space-y-2">
                <a href="/dashboard/admin" className="block text-sm text-brand-600 hover:text-brand-700">
                  Manage Users &rarr;
                </a>
                <a href="/dashboard/plans" className="block text-sm text-brand-600 hover:text-brand-700">
                  Manage Plans &rarr;
                </a>
                <a href="/dashboard/targets" className="block text-sm text-brand-600 hover:text-brand-700">
                  Manage Targets &rarr;
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
