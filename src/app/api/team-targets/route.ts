import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { role } = session.user
    if (role !== 'ADMIN' && role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fiscalYear = req.nextUrl.searchParams.get('fiscalYear') || ''

    const where: Record<string, unknown> = {}
    if (fiscalYear) {
      where.period = { startsWith: fiscalYear }
    }

    const targets = await prisma.teamTarget.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ manager: { name: 'asc' } }, { period: 'asc' }],
    })

    return NextResponse.json(targets)
  } catch (error) {
    console.error('Team targets GET error:', error)
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
    const { managerId, period, nfiTargetGBP, placementTarget } = body

    if (!managerId || !period || nfiTargetGBP === undefined) {
      return NextResponse.json({ error: 'managerId, period, and nfiTargetGBP are required' }, { status: 400 })
    }

    const target = await prisma.teamTarget.upsert({
      where: { managerId_period: { managerId, period } },
      update: {
        nfiTargetGBP,
        ...(placementTarget !== undefined ? { placementTarget } : {}),
      },
      create: {
        managerId,
        period,
        nfiTargetGBP,
        placementTarget: placementTarget || null,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(target)
  } catch (error) {
    console.error('Team targets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
