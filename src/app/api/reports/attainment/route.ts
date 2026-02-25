import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const repId = searchParams.get('repId')

    const isAdmin = user.role === 'admin' || user.role === 'manager'

    // Determine which reps to report on
    let reps: { id: string; name: string; email: string; planId: string | null }[]

    if (isAdmin && !repId) {
      reps = await prisma.user.findMany({
        where: { role: 'rep' },
        select: { id: true, name: true, email: true, planId: true },
        orderBy: { name: 'asc' },
      })
    } else {
      const targetId = isAdmin && repId ? repId : user.id
      const u = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true, name: true, email: true, planId: true },
      })
      reps = u ? [u] : []
    }

    const results = []

    for (const rep of reps) {
      const monthlyData = []

      for (let month = 1; month <= 12; month++) {
        const period = `${year}-${String(month).padStart(2, '0')}`
        const periodStart = new Date(parseInt(year), month - 1, 1)
        const periodEnd = new Date(parseInt(year), month, 1)

        // Get quota
        const quota = await prisma.quotaTarget.findUnique({
          where: { repId_period: { repId: rep.id, period } },
        })

        // Get closed-won revenue
        const revenue = await prisma.deal.aggregate({
          where: {
            repId: rep.id,
            status: 'closed_won',
            closeDate: { gte: periodStart, lt: periodEnd },
          },
          _sum: { amount: true },
          _count: true,
        })

        // Get commissions
        const commissions = await prisma.commission.aggregate({
          where: { repId: rep.id, period },
          _sum: { amount: true },
        })

        const target = quota?.targetAmount || 0
        const actual = revenue._sum.amount || 0
        const attainment = target > 0 ? actual / target : 0
        const commissionTotal = commissions._sum.amount || 0

        monthlyData.push({
          period,
          month,
          monthLabel: periodStart.toLocaleDateString('en-US', { month: 'short' }),
          target,
          actual,
          attainment,
          gap: target - actual,
          dealCount: revenue._count,
          commissions: commissionTotal,
        })
      }

      // YTD totals
      const ytdTarget = monthlyData.reduce((s, m) => s + m.target, 0)
      const ytdActual = monthlyData.reduce((s, m) => s + m.actual, 0)
      const ytdCommissions = monthlyData.reduce((s, m) => s + m.commissions, 0)

      results.push({
        rep: { id: rep.id, name: rep.name, email: rep.email },
        monthly: monthlyData,
        ytd: {
          target: ytdTarget,
          actual: ytdActual,
          attainment: ytdTarget > 0 ? ytdActual / ytdTarget : 0,
          gap: ytdTarget - ytdActual,
          commissions: ytdCommissions,
        },
      })
    }

    return NextResponse.json({ reports: results, year })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
