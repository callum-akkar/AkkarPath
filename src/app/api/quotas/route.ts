import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const repId = searchParams.get('repId')
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    const where: Record<string, unknown> = {
      period: { startsWith: `${year}-` },
    }

    if (user.role !== 'admin' && user.role !== 'manager') {
      where.repId = user.id
    } else if (repId) {
      where.repId = repId
    }

    const quotas = await prisma.quotaTarget.findMany({
      where,
      include: {
        rep: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ period: 'asc' }],
    })

    return NextResponse.json({ quotas })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { repId, period, periodType, targetAmount } = await req.json()

    const quota = await prisma.quotaTarget.upsert({
      where: { repId_period: { repId, period } },
      update: { targetAmount: parseFloat(targetAmount), periodType: periodType || 'monthly' },
      create: {
        repId,
        period,
        periodType: periodType || 'monthly',
        targetAmount: parseFloat(targetAmount),
      },
      include: {
        rep: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ quota }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
