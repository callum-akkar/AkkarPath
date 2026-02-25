import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireAuth()
    const isAdmin = user.role === 'admin' || user.role === 'manager'

    const repFilter = isAdmin ? {} : { repId: user.id }

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

    // Quota attainment for current period
    let currentQuota = 0
    let currentRevenue = 0

    if (isAdmin) {
      // Sum all rep quotas for current period
      const quotaSum = await prisma.quotaTarget.aggregate({
        where: { period: currentPeriod },
        _sum: { targetAmount: true },
      })
      currentQuota = quotaSum._sum.targetAmount || 0

      const revSum = await prisma.deal.aggregate({
        where: {
          status: 'closed_won',
          closeDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        },
        _sum: { amount: true },
      })
      currentRevenue = revSum._sum.amount || 0
    } else {
      const quota = await prisma.quotaTarget.findUnique({
        where: { repId_period: { repId: user.id, period: currentPeriod } },
      })
      currentQuota = quota?.targetAmount || 0

      const revSum = await prisma.deal.aggregate({
        where: {
          repId: user.id,
          status: 'closed_won',
          closeDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
          },
        },
        _sum: { amount: true },
      })
      currentRevenue = revSum._sum.amount || 0
    }

    const attainmentPct = currentQuota > 0 ? currentRevenue / currentQuota : 0

    // Pipeline value
    const pipelineResult = await prisma.deal.aggregate({
      where: { ...repFilter, status: 'open' },
      _sum: { amount: true },
    })
    const pipelineValue = pipelineResult._sum.amount || 0

    // Monthly trend (last 6 months) with quota
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

      // Quota for this period
      let monthQuota = 0
      if (isAdmin) {
        const q = await prisma.quotaTarget.aggregate({
          where: { period },
          _sum: { targetAmount: true },
        })
        monthQuota = q._sum.targetAmount || 0
      } else {
        const q = await prisma.quotaTarget.findUnique({
          where: { repId_period: { repId: user.id, period } },
        })
        monthQuota = q?.targetAmount || 0
      }

      monthlyData.push({
        period,
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: monthRevenue._sum.amount || 0,
        quota: monthQuota,
        commissions: monthCommissions._sum.amount || 0,
      })
    }

    // Top reps (admin only)
    let topReps: { name: string; total: number; attainment: number }[] = []
    if (isAdmin) {
      const reps = await prisma.user.findMany({
        where: { role: 'rep' },
        select: {
          id: true,
          name: true,
          commissions: { select: { amount: true } },
        },
      })

      const repData = []
      for (const r of reps) {
        const quota = await prisma.quotaTarget.findUnique({
          where: { repId_period: { repId: r.id, period: currentPeriod } },
        })
        const rev = await prisma.deal.aggregate({
          where: {
            repId: r.id,
            status: 'closed_won',
            closeDate: {
              gte: new Date(now.getFullYear(), now.getMonth(), 1),
              lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
            },
          },
          _sum: { amount: true },
        })

        repData.push({
          name: r.name,
          total: r.commissions.reduce((sum, c) => sum + c.amount, 0),
          attainment: quota?.targetAmount
            ? (rev._sum.amount || 0) / quota.targetAmount
            : 0,
        })
      }

      topReps = repData.sort((a, b) => b.total - a.total).slice(0, 5)
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
      pipelineValue,
      currentQuota,
      currentRevenue,
      attainmentPct,
      monthlyData,
      topReps,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
