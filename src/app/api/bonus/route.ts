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

    const bonuses = await prisma.bonusEntry.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(bonuses)
  } catch (error) {
    console.error('Bonus GET error:', error)
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
    const { userId, description, amount, period, bonusType } = body

    if (!userId || !description || amount === undefined || !period) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const bonus = await prisma.bonusEntry.create({
      data: {
        userId,
        description,
        amount: parseFloat(amount),
        period,
        bonusType: bonusType || 'BONUS',
        status: 'PENDING',
        createdByUserId: session.user.id,
      },
    })

    return NextResponse.json(bonus, { status: 201 })
  } catch (error) {
    console.error('Bonus POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
