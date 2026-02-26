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
    const type = searchParams.get('type') || 'all' // all, paid, payroll, placement, timesheet

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

    // Filter by source type if requested
    let filtered = entries
    if (type === 'placement') {
      filtered = entries.filter(e => e.sourceType === 'PLACEMENT')
    } else if (type === 'timesheet') {
      filtered = entries.filter(e => e.sourceType === 'TIMESHEET')
    }

    // Build CSV
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
