import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'
import { getFiscalYear, getFiscalPeriod, getQuarterDateRange, getQuarterLabel, getFiscalQuarter } from '@/lib/fiscal-year'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: sessionUserId, role } = session.user
    const now = new Date()
    const currentFY = getFiscalYear(now)
    const currentQuarterPeriod = getFiscalPeriod(now)
    const currentQuarterNum = getFiscalQuarter(now)
    const currentQuarterLabel = `${currentFY} ${getQuarterLabel(currentQuarterNum)}`
    const { start: qStart, end: qEnd } = getQuarterDateRange(currentQuarterPeriod)

    // ─── Parse filter query params ────────────────────────────────
    const searchParams = req.nextUrl.searchParams
    const filterUserId = searchParams.get('userId')
    const filterManagerId = searchParams.get('managerId')
    const filterDepartment = searchParams.get('department')
    const filterRole = searchParams.get('role')

    // ─── Build userIds based on role + filters ────────────────────
    let userIds: string[]
    let filteredUserCount = 0
    let filterLabel: string | null = null

    if (role === 'REP') {
      // REPs always see only their own data — ignore all filters
      userIds = [sessionUserId]
      filteredUserCount = 1
    } else if (role === 'ADMIN') {
      // Admin: apply all filters unrestricted
      const where: Record<string, unknown> = { isActive: true }

      if (filterUserId) {
        where.id = filterUserId
      } else {
        if (filterManagerId) {
          where.OR = [{ id: filterManagerId }, { managerId: filterManagerId }]
        }
        if (filterDepartment) {
          where.department = filterDepartment
        }
        if (filterRole) {
          where.role = filterRole
        }
      }

      const users = await prisma.user.findMany({ where, select: { id: true } })
      userIds = users.map(u => u.id)
      filteredUserCount = userIds.length
    } else {
      // MANAGER: can only filter within own team (self + direct reports)
      const teamUsers = await prisma.user.findMany({
        where: { OR: [{ id: sessionUserId }, { managerId: sessionUserId }], isActive: true },
        select: { id: true, department: true, role: true },
      })
      let filtered = teamUsers

      if (filterUserId) {
        // Only allow if the user is in the manager's team
        const inTeam = teamUsers.some(u => u.id === filterUserId)
        if (inTeam) {
          filtered = teamUsers.filter(u => u.id === filterUserId)
        }
        // If not in team, fall through to default team view
      } else {
        if (filterDepartment) {
          filtered = filtered.filter(u => u.department === filterDepartment)
        }
        if (filterRole) {
          filtered = filtered.filter(u => u.role === filterRole)
        }
      }

      userIds = filtered.map(u => u.id)
      filteredUserCount = userIds.length
    }

    // Determine if any filter is active
    const hasFilter = !!(filterUserId || filterManagerId || filterDepartment || filterRole)

    // Build a label describing what the filter is showing
    if (filterUserId && userIds.length === 1) {
      const person = await prisma.user.findUnique({ where: { id: filterUserId }, select: { name: true, jobTitle: true } })
      filterLabel = person ? `${person.name}${person.jobTitle ? ` (${person.jobTitle})` : ''}` : null
    } else if (hasFilter) {
      const parts: string[] = []
      if (filterManagerId) {
        const mgr = await prisma.user.findUnique({ where: { id: filterManagerId }, select: { name: true } })
        if (mgr) parts.push(`${mgr.name}'s Team`)
      }
      if (filterDepartment) parts.push(`${filterDepartment} Department`)
      if (filterRole) parts.push(`${filterRole.charAt(0) + filterRole.slice(1).toLowerCase()} Role`)
      filterLabel = parts.join(' · ')
    }

    // ─── Commission entries for current fiscal quarter ────────────
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

    // ─── Revenue from placements this quarter ─────────────────────
    const placements = await prisma.placement.findMany({
      where: {
        ownerUserId: { in: userIds },
        invoicedDate: { gte: qStart, lt: qEnd },
        paidToAkkar: true,
      },
    })

    const totalRevenue = placements
      .reduce((sum, p) => sum.add(new Decimal(p.nfiValue.toString())), new Decimal(0))

    // ─── Open pipeline ────────────────────────────────────────────
    const pipelinePlacements = await prisma.placement.findMany({
      where: { ownerUserId: { in: userIds }, paidToAkkar: false, isClawback: false },
    })
    const pipelineValue = pipelinePlacements
      .reduce((sum, p) => sum.add(new Decimal(p.nfiValue.toString())), new Decimal(0))

    // ─── Target attainment ────────────────────────────────────────
    // Show individual target when viewing a single person, otherwise sum all targets
    let currentQuota = 0
    if (userIds.length === 1) {
      const target = await prisma.target.findUnique({
        where: { userId_period: { userId: userIds[0], period: currentQuarterPeriod } },
      })
      currentQuota = target ? Number(target.nfiTargetGBP) : 0
    } else {
      const targets = await prisma.target.findMany({
        where: { userId: { in: userIds }, period: currentQuarterPeriod },
      })
      currentQuota = targets.reduce((sum, t) => sum + Number(t.nfiTargetGBP), 0)
    }
    const attainmentPct = currentQuota > 0 ? totalRevenue.toNumber() / currentQuota : 0

    // ─── Quarterly data (4 quarters of current FY) ────────────────
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

      // Sum targets for the filtered user set
      let qQuota = 0
      if (userIds.length === 1) {
        const qTarget = await prisma.target.findUnique({
          where: { userId_period: { userId: userIds[0], period } },
        })
        qQuota = qTarget ? Number(qTarget.nfiTargetGBP) : 0
      } else {
        const qTargets = await prisma.target.findMany({
          where: { userId: { in: userIds }, period },
        })
        qQuota = qTargets.reduce((sum, t) => sum + Number(t.nfiTargetGBP), 0)
      }

      quarterlyData.push({
        period,
        label,
        revenue: qPlacements.reduce((s, p) => s + Number(p.nfiValue), 0),
        quota: qQuota,
        commissions: qEntries.reduce((s, e) => s + Number(e.commissionAmount), 0),
      })
    }

    // ─── Top performers (within filtered group) ───────────────────
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
      // Filter metadata
      hasFilter,
      filterLabel,
      filteredUserCount,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
