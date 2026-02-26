import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'

function dateToPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: userId, role } = session.user
    const now = new Date()
    const currentPeriod = dateToPeriod(now)

    // Build user filter based on role
    let userIds: string[]
    if (role === 'ADMIN') {
      const allUsers = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } })
      userIds = allUsers.map(u => u.id)
    } else if (role === 'MANAGER') {
      const teamUsers = await prisma.user.findMany({
        where: { OR: [{ id: userId }, { managerId: userId }], isActive: true },
        select: { id: true },
      })
      userIds = teamUsers.map(u => u.id)
    } else {
      userIds = [userId]
    }

    // Commission entries for current period
    const currentEntries = await prisma.commissionEntry.findMany({
      where: { userId: { in: userIds }, period: currentPeriod },
    })

    const totalCommissions = currentEntries
      .reduce((sum, e) => sum.add(new Decimal(e.commissionAmount.toString())), new Decimal(0))
    const pendingAmount = currentEntries
      .filter(e => e.status === 'PENDING')
      .reduce((sum, e) => sum.add(new Decimal(e.commissionAmount.toString())), new Decimal(0))
    const paidAmount = currentEntries
      .filter(e => e.status === 'PAID')
      .reduce((sum, e) => sum.add(new Decimal(e.commissionAmount.toString())), new Decimal(0))

    // Revenue from placements this period
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const placements = await prisma.placement.findMany({
      where: {
        ownerUserId: { in: userIds },
        invoicedDate: { gte: periodStart, lt: periodEnd },
        paidToAkkar: true,
      },
    })

    const totalRevenue = placements
      .reduce((sum, p) => sum.add(new Decimal(p.nfiValue.toString())), new Decimal(0))

    // Open pipeline
    const pipelinePlacements = await prisma.placement.findMany({
      where: { ownerUserId: { in: userIds }, paidToAkkar: false, isClawback: false },
    })
    const pipelineValue = pipelinePlacements
      .reduce((sum, p) => sum.add(new Decimal(p.nfiValue.toString())), new Decimal(0))

    // Target for quota attainment (REP only for personal)
    const target = role === 'REP'
      ? await prisma.target.findUnique({ where: { userId_period: { userId, period: currentPeriod } } })
      : null
    const currentQuota = target ? Number(target.nfiTargetGBP) : 0
    const attainmentPct = currentQuota > 0 ? totalRevenue.toNumber() / currentQuota : 0

    // Monthly data (last 6 months)
    const monthlyData = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const period = dateToPeriod(d)
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const label = d.toLocaleString('en-US', { month: 'short' })

      const [mEntries, mPlacements] = await Promise.all([
        prisma.commissionEntry.findMany({ where: { userId: { in: userIds }, period } }),
        prisma.placement.findMany({
          where: { ownerUserId: { in: userIds }, invoicedDate: { gte: d, lt: mEnd }, paidToAkkar: true },
        }),
      ])

      const mTarget = role === 'REP'
        ? await prisma.target.findUnique({ where: { userId_period: { userId, period } } })
        : null

      monthlyData.push({
        period,
        label,
        revenue: mPlacements.reduce((s, p) => s + Number(p.nfiValue), 0),
        quota: mTarget ? Number(mTarget.nfiTargetGBP) : 0,
        commissions: mEntries.reduce((s, e) => s + Number(e.commissionAmount), 0),
      })
    }

    // Top reps (managers/admins)
    const topReps: { name: string; total: number; attainment: number }[] = []
    if (role === 'ADMIN' || role === 'MANAGER') {
      const teamUsers = await prisma.user.findMany({
        where: { id: { in: userIds }, isActive: true },
        select: { id: true, name: true },
      })
      for (const u of teamUsers) {
        const entries = await prisma.commissionEntry.findMany({
          where: { userId: u.id, period: currentPeriod },
        })
        const total = entries.reduce((s, e) => s + Number(e.commissionAmount), 0)
        const uTarget = await prisma.target.findUnique({
          where: { userId_period: { userId: u.id, period: currentPeriod } },
        })
        const att = uTarget ? total / Number(uTarget.nfiTargetGBP) : 0
        topReps.push({ name: u.name, total, attainment: att })
      }
      topReps.sort((a, b) => b.total - a.total)
    }

    return NextResponse.json({
      currentPeriod,
      totalDeals: placements.length + pipelinePlacements.length,
      closedWonDeals: placements.length,
      openDeals: pipelinePlacements.length,
      totalRevenue: totalRevenue.toNumber(),
      totalCommissions: totalCommissions.toNumber(),
      pendingAmount: pendingAmount.toNumber(),
      paidAmount: paidAmount.toNumber(),
      pipelineValue: pipelineValue.toNumber(),
      currentQuota,
      currentRevenue: totalRevenue.toNumber(),
      attainmentPct,
      monthlyData,
      topReps: topReps.slice(0, 10),
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
