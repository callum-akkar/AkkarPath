import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import { getFiscalYear, getFiscalPeriod, getQuarterDateRange, getQuarterLabel, getFiscalQuarter } from '@/lib/fiscal-year'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: userId, role } = session.user
    const now = new Date()
    const currentFY = getFiscalYear(now)
    const currentQuarterPeriod = getFiscalPeriod(now)
    const currentQuarterNum = getFiscalQuarter(now)
    const currentQuarterLabel = `${currentFY} ${getQuarterLabel(currentQuarterNum)}`

    // Get the date range for the current fiscal quarter
    const { start: qStart, end: qEnd } = getQuarterDateRange(currentQuarterPeriod)

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

    // Commission entries for current fiscal quarter
    const currentEntries = await prisma.commissionEntry.findMany({
      where: { userId: { in: userIds }, period: currentQuarterPeriod },
    })

    const totalCommissions = currentEntries
      .reduce((sum, e) => sum.add(new Decimal(e.commissionAmount.toString())), new Decimal(0))
    const pendingAmount = currentEntries
      .filter(e => e.status === 'PENDING')
      .reduce((sum, e) => sum.add(new Decimal(e.commissionAmount.toString())), new Decimal(0))
    const paidAmount = currentEntries
      .filter(e => e.status === 'PAID')
      .reduce((sum, e) => sum.add(new Decimal(e.commissionAmount.toString())), new Decimal(0))

    // Revenue from placements this quarter
    const placements = await prisma.placement.findMany({
      where: {
        ownerUserId: { in: userIds },
        invoicedDate: { gte: qStart, lt: qEnd },
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
      ? await prisma.target.findUnique({ where: { userId_period: { userId, period: currentQuarterPeriod } } })
      : null
    const currentQuota = target ? Number(target.nfiTargetGBP) : 0
    const attainmentPct = currentQuota > 0 ? totalRevenue.toNumber() / currentQuota : 0

    // Quarterly data (4 quarters of current FY)
    const quarterlyData = []
    for (let q = 1; q <= 4; q++) {
      const period = `${currentFY}-Q${q}`
      const label = getQuarterLabel(q)

      let qStartDate: Date
      let qEndDate: Date
      try {
        const range = getQuarterDateRange(period)
        qStartDate = range.start
        qEndDate = range.end
      } catch {
        continue
      }

      const [qEntries, qPlacements] = await Promise.all([
        prisma.commissionEntry.findMany({ where: { userId: { in: userIds }, period } }),
        prisma.placement.findMany({
          where: { ownerUserId: { in: userIds }, invoicedDate: { gte: qStartDate, lt: qEndDate }, paidToAkkar: true },
        }),
      ])

      const qTarget = role === 'REP'
        ? await prisma.target.findUnique({ where: { userId_period: { userId, period } } })
        : null

      quarterlyData.push({
        period,
        label,
        revenue: qPlacements.reduce((s, p) => s + Number(p.nfiValue), 0),
        quota: qTarget ? Number(qTarget.nfiTargetGBP) : 0,
        commissions: qEntries.reduce((s, e) => s + Number(e.commissionAmount), 0),
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
          where: { userId: u.id, period: currentQuarterPeriod },
        })
        const total = entries.reduce((s, e) => s + Number(e.commissionAmount), 0)
        const uTarget = await prisma.target.findUnique({
          where: { userId_period: { userId: u.id, period: currentQuarterPeriod } },
        })
        const att = uTarget && Number(uTarget.nfiTargetGBP) > 0 ? total / Number(uTarget.nfiTargetGBP) : 0
        topReps.push({ name: u.name, total, attainment: att })
      }
      topReps.sort((a, b) => b.total - a.total)
    }

    return NextResponse.json({
      currentPeriod: currentQuarterLabel,
      currentFY,
      currentQuarter: currentQuarterPeriod,
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
      monthlyData: quarterlyData,
      topReps: topReps.slice(0, 10),
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
