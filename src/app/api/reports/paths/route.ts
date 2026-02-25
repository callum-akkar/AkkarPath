import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { computeEarningsPath, getRepProjection } from '@/lib/commissions'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const repId = searchParams.get('repId')
    const isAdmin = user.role === 'admin' || user.role === 'manager'

    const targetId = isAdmin && repId ? repId : user.id

    const projection = await getRepProjection(targetId)

    if (!projection.plan) {
      return NextResponse.json({
        error: 'No commission plan assigned',
        projection: null,
        earningsPath: [],
      })
    }

    const earningsPath = computeEarningsPath(projection.plan, projection.annualQuota)

    // Get ramp schedule if any
    const rampSchedule = await prisma.rampPeriod.findMany({
      where: { planId: projection.plan.id },
      orderBy: { month: 'asc' },
    })

    return NextResponse.json({
      projection,
      earningsPath,
      rampSchedule,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
