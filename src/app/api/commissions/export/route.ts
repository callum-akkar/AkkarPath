import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period')
    const type = searchParams.get('type') || 'all'

    // Payroll summary: one row per employee
    if (type === 'payroll-summary') {
      return handlePayrollSummary(period)
    }

    // Standard entry-level exports
    const where: Record<string, unknown> = {}
    if (period) where.period = period

    switch (type) {
      case 'paid':
        where.status = 'PAID'
        break
      case 'payroll':
        where.status = { in: ['APPROVED', 'PAID'] }
        break
    }

    const entries = await prisma.commissionEntry.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, jobTitle: true, department: true, salary: true } },
        planComponent: { select: { name: true, type: true } },
        sourcePlacement: { select: { name: true, salesforceId: true, candidateName: true, placementType: true, account: { select: { name: true } } } },
        sourceTimesheet: { select: { name: true, salesforceId: true, candidateName: true, account: { select: { name: true } } } },
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
    })

    let filtered = entries
    if (type === 'placement') {
      filtered = entries.filter(e => e.sourceType === 'PLACEMENT')
    } else if (type === 'timesheet') {
      filtered = entries.filter(e => e.sourceType === 'TIMESHEET')
    }

    const headers = [
      'Period',
      'Employee Name',
      'Employee Email',
      'Job Title',
      'Department',
      'Source Type',
      'Source Name',
      'Source SF ID',
      'Candidate',
      'Account',
      'Component',
      'Component Type',
      'Gross Value',
      'Rate',
      'Commission Amount',
      'Status',
      'Is Clawback',
      'Is Manual Override',
      'Note',
      'Payout Date',
      'Created At',
    ]

    const rows = filtered.map(e => {
      const source = e.sourcePlacement || e.sourceTimesheet
      return [
        e.period,
        e.user.name,
        e.user.email,
        e.user.jobTitle || '',
        e.user.department || '',
        e.sourceType,
        source?.name || '',
        source?.salesforceId || '',
        source?.candidateName || '',
        (e.sourcePlacement?.account?.name || e.sourceTimesheet?.account?.name || ''),
        e.planComponent?.name || '',
        e.planComponent?.type || '',
        Number(e.grossValue).toFixed(2),
        Number(e.rate).toFixed(6),
        Number(e.commissionAmount).toFixed(2),
        e.status,
        e.isClawback ? 'Yes' : 'No',
        e.isManualOverride ? 'Yes' : 'No',
        e.manualOverrideNote || '',
        e.payoutDate ? e.payoutDate.toISOString().split('T')[0] : '',
        e.createdAt.toISOString().split('T')[0],
      ]
    })

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="commissions-${type}-${period || 'all'}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handlePayrollSummary(period: string | null) {
  // Get all active users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      jobTitle: true,
      department: true,
      salary: true,
    },
    orderBy: { name: 'asc' },
  })

  // Build commission where clause
  const commissionWhere: Record<string, unknown> = {
    status: { in: ['APPROVED', 'PAID'] },
  }
  if (period) commissionWhere.period = period

  // Get all commission entries for the period
  const commissionEntries = await prisma.commissionEntry.findMany({
    where: commissionWhere,
    select: {
      userId: true,
      commissionAmount: true,
      status: true,
    },
  })

  // Build bonus where clause
  const bonusWhere: Record<string, unknown> = {
    status: { in: ['APPROVED', 'PAID'] },
  }
  if (period) bonusWhere.period = period

  // Get all bonus entries for the period
  const bonusEntries = await prisma.bonusEntry.findMany({
    where: bonusWhere,
    select: {
      userId: true,
      amount: true,
    },
  })

  // Aggregate by user
  const commissionByUser = new Map<string, { total: number; approved: number; paid: number; count: number }>()
  for (const entry of commissionEntries) {
    const existing = commissionByUser.get(entry.userId) || { total: 0, approved: 0, paid: 0, count: 0 }
    const amount = Number(entry.commissionAmount)
    existing.total += amount
    existing.count += 1
    if (entry.status === 'APPROVED') existing.approved += 1
    if (entry.status === 'PAID') existing.paid += 1
    commissionByUser.set(entry.userId, existing)
  }

  const bonusByUser = new Map<string, number>()
  for (const entry of bonusEntries) {
    const existing = bonusByUser.get(entry.userId) || 0
    bonusByUser.set(entry.userId, existing + Number(entry.amount))
  }

  // Build CSV
  const headers = [
    'Employee Name',
    'Employee Email',
    'Job Title',
    'Department',
    'Base Salary',
    'Total Commission',
    'Total Bonus',
    'Total Pay',
    'Period',
    'Number of Entries',
    'Status Breakdown',
  ]

  const rows = users.map(user => {
    const commission = commissionByUser.get(user.id) || { total: 0, approved: 0, paid: 0, count: 0 }
    const bonus = bonusByUser.get(user.id) || 0
    const baseSalary = user.salary ? Number(user.salary) : 0
    const totalPay = baseSalary + commission.total + bonus

    const statusParts = []
    if (commission.approved > 0) statusParts.push(`${commission.approved} Approved`)
    if (commission.paid > 0) statusParts.push(`${commission.paid} Paid`)
    const statusBreakdown = statusParts.length > 0 ? statusParts.join(', ') : 'None'

    return [
      user.name,
      user.email,
      user.jobTitle || '',
      user.department || '',
      baseSalary.toFixed(2),
      commission.total.toFixed(2),
      bonus.toFixed(2),
      totalPay.toFixed(2),
      period || 'All',
      String(commission.count),
      statusBreakdown,
    ]
  })

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="payroll-summary-${period || 'all'}.csv"`,
    },
  })
}
