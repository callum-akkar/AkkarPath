import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period')
    const userId = searchParams.get('userId')

    const { role } = session.user
    const where: Record<string, unknown> = {}

    if (role === 'REP') {
      where.userId = session.user.id
    } else if (role === 'MANAGER') {
      const team = await prisma.user.findMany({
        where: { OR: [{ id: session.user.id }, { managerId: session.user.id }] },
        select: { id: true },
      })
      where.userId = userId ? userId : { in: team.map(u => u.id) }
    } else if (userId) {
      where.userId = userId
    }

    if (period) where.period = period

    const targets = await prisma.target.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ period: 'desc' }, { userId: 'asc' }],
    })

    return NextResponse.json(targets)
  } catch (error) {
    console.error('Targets GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, period, nfiTargetGBP, placementTargetCount, contractRevenueTarget } = body

    if (!userId || !period || nfiTargetGBP === undefined) {
      return NextResponse.json({ error: 'userId, period, and nfiTargetGBP are required' }, { status: 400 })
    }

    const target = await prisma.target.upsert({
      where: { userId_period: { userId, period } },
      create: {
        userId,
        period,
        nfiTargetGBP: parseFloat(nfiTargetGBP),
        placementTargetCount: placementTargetCount ? parseInt(placementTargetCount) : null,
        contractRevenueTarget: contractRevenueTarget ? parseFloat(contractRevenueTarget) : null,
      },
      update: {
        nfiTargetGBP: parseFloat(nfiTargetGBP),
        placementTargetCount: placementTargetCount ? parseInt(placementTargetCount) : null,
        contractRevenueTarget: contractRevenueTarget ? parseFloat(contractRevenueTarget) : null,
      },
    })

    return NextResponse.json(target)
  } catch (error) {
    console.error('Target POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Bulk update targets
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { targets } = body as { targets: { userId: string; period: string; nfiTargetGBP: number; placementTargetCount?: number; contractRevenueTarget?: number }[] }

    if (!targets || !Array.isArray(targets)) {
      return NextResponse.json({ error: 'targets array is required' }, { status: 400 })
    }

    const results = []
    for (const t of targets) {
      const result = await prisma.target.upsert({
        where: { userId_period: { userId: t.userId, period: t.period } },
        create: {
          userId: t.userId,
          period: t.period,
          nfiTargetGBP: t.nfiTargetGBP,
          placementTargetCount: t.placementTargetCount || null,
          contractRevenueTarget: t.contractRevenueTarget || null,
        },
        update: {
          nfiTargetGBP: t.nfiTargetGBP,
          placementTargetCount: t.placementTargetCount || null,
          contractRevenueTarget: t.contractRevenueTarget || null,
        },
      })
      results.push(result)
    }

    return NextResponse.json({ updated: results.length })
  } catch (error) {
    console.error('Target PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
