import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// Bulk set quotas for all reps for a given year
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { year, monthlyAmount, repIds } = await req.json()

    if (!year || !monthlyAmount) {
      return NextResponse.json({ error: 'year and monthlyAmount required' }, { status: 400 })
    }

    const targetReps = repIds && repIds.length > 0
      ? repIds
      : (await prisma.user.findMany({ where: { role: 'rep' }, select: { id: true } })).map((u: { id: string }) => u.id)

    const results = []

    for (const repId of targetReps) {
      for (let month = 1; month <= 12; month++) {
        const period = `${year}-${String(month).padStart(2, '0')}`
        const quota = await prisma.quotaTarget.upsert({
          where: { repId_period: { repId, period } },
          update: { targetAmount: parseFloat(monthlyAmount) },
          create: {
            repId,
            period,
            periodType: 'monthly',
            targetAmount: parseFloat(monthlyAmount),
          },
        })
        results.push(quota)
      }
    }

    return NextResponse.json({ created: results.length })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
