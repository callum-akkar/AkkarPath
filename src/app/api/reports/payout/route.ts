import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const reps = await prisma.user.findMany({
      where: { role: 'rep' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    })

    const payoutData = []

    for (const rep of reps) {
      const monthlyPayouts = []

      for (let month = 1; month <= 12; month++) {
        const period = `${year}-${String(month).padStart(2, '0')}`

        const pending = await prisma.commission.aggregate({
          where: { repId: rep.id, period, status: 'pending' },
          _sum: { amount: true },
        })
        const approved = await prisma.commission.aggregate({
          where: { repId: rep.id, period, status: 'approved' },
          _sum: { amount: true },
        })
        const paid = await prisma.commission.aggregate({
          where: { repId: rep.id, period, status: 'paid' },
          _sum: { amount: true },
        })

        monthlyPayouts.push({
          period,
          month,
          pending: pending._sum.amount || 0,
          approved: approved._sum.amount || 0,
          paid: paid._sum.amount || 0,
          total: (pending._sum.amount || 0) + (approved._sum.amount || 0) + (paid._sum.amount || 0),
        })
      }

      const totalPending = monthlyPayouts.reduce((s, m) => s + m.pending, 0)
      const totalApproved = monthlyPayouts.reduce((s, m) => s + m.approved, 0)
      const totalPaid = monthlyPayouts.reduce((s, m) => s + m.paid, 0)

      payoutData.push({
        rep,
        monthly: monthlyPayouts,
        totals: {
          pending: totalPending,
          approved: totalApproved,
          paid: totalPaid,
          total: totalPending + totalApproved + totalPaid,
        },
      })
    }

    // Team totals
    const teamTotals = {
      pending: payoutData.reduce((s, r) => s + r.totals.pending, 0),
      approved: payoutData.reduce((s, r) => s + r.totals.approved, 0),
      paid: payoutData.reduce((s, r) => s + r.totals.paid, 0),
      total: payoutData.reduce((s, r) => s + r.totals.total, 0),
    }

    return NextResponse.json({ payoutData, teamTotals, year })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
