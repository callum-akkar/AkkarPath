import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireAuth()
    const isAdmin = user.role === 'admin' || user.role === 'manager'

    const repFilter = isAdmin ? {} : { repId: user.id }

    // Get current period
    const now = new Date()
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Total deals
    const totalDeals = await prisma.deal.count({ where: repFilter })
    const closedWonDeals = await prisma.deal.count({
      where: { ...repFilter, status: 'closed_won' },
    })
    const openDeals = await prisma.deal.count({
      where: { ...repFilter, status: 'open' },
    })

    // Deal revenue
    const revenueResult = await prisma.deal.aggregate({
      where: { ...repFilter, status: 'closed_won' },
      _sum: { amount: true },
    })
    const totalRevenue = revenueResult._sum.amount || 0

    // Commission stats
    const commissionResult = await prisma.commission.aggregate({
      where: repFilter,
      _sum: { amount: true },
    })
    const totalCommissions = commissionResult._sum.amount || 0

    const pendingCommissions = await prisma.commission.aggregate({
      where: { ...repFilter, status: 'pending' },
      _sum: { amount: true },
    })
    const pendingAmount = pendingCommissions._sum.amount || 0

    const paidCommissions = await prisma.commission.aggregate({
      where: { ...repFilter, status: 'paid' },
      _sum: { amount: true },
    })
    const paidAmount = paidCommissions._sum.amount || 0

    // Monthly trend (last 6 months)
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

      const monthRevenue = await prisma.deal.aggregate({
        where: {
          ...repFilter,
          status: 'closed_won',
          closeDate: {
            gte: d,
            lt: new Date(d.getFullYear(), d.getMonth() + 1, 1),
          },
        },
        _sum: { amount: true },
      })

      const monthCommissions = await prisma.commission.aggregate({
        where: { ...repFilter, period },
        _sum: { amount: true },
      })

      monthlyData.push({
        period,
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: monthRevenue._sum.amount || 0,
        commissions: monthCommissions._sum.amount || 0,
      })
    }

    // Top reps (admin only)
    let topReps: { name: string; total: number }[] = []
    if (isAdmin) {
      const reps = await prisma.user.findMany({
        where: { role: 'rep' },
        select: {
          name: true,
          commissions: {
            select: { amount: true },
          },
        },
      })

      topReps = reps
        .map((r) => ({
          name: r.name,
          total: r.commissions.reduce((sum, c) => sum + c.amount, 0),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
    }

    return NextResponse.json({
      currentPeriod,
      totalDeals,
      closedWonDeals,
      openDeals,
      totalRevenue,
      totalCommissions,
      pendingAmount,
      paidAmount,
      monthlyData,
      topReps,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
