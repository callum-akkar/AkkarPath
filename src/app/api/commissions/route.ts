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
    const status = searchParams.get('status')
    const userIdParam = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const { id: userId, role } = session.user
    const where: Record<string, unknown> = {}

    if (role === 'REP') {
      where.userId = userId
    } else if (role === 'MANAGER') {
      if (userIdParam) {
        const teamUser = await prisma.user.findFirst({
          where: { id: userIdParam, OR: [{ id: userId }, { managerId: userId }] },
        })
        if (!teamUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        where.userId = userIdParam
      } else {
        const team = await prisma.user.findMany({
          where: { OR: [{ id: userId }, { managerId: userId }] },
          select: { id: true },
        })
        where.userId = { in: team.map(u => u.id) }
      }
    } else if (role === 'ADMIN' && userIdParam) {
      where.userId = userIdParam
    }

    if (period) where.period = period
    if (status) where.status = status

    const [entries, total] = await Promise.all([
      prisma.commissionEntry.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          planComponent: { select: { id: true, name: true, type: true } },
          sourcePlacement: { select: { id: true, name: true, salesforceId: true, candidateName: true, account: { select: { name: true } } } },
          sourceTimesheet: { select: { id: true, name: true, salesforceId: true, candidateName: true, account: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.commissionEntry.count({ where }),
    ])

    return NextResponse.json({
      entries,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Commissions GET error:', error)
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
    const { userId, period, commissionAmount, grossValue, sourceType, note, rate } = body

    if (!userId || !period || commissionAmount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const entry = await prisma.commissionEntry.create({
      data: {
        userId,
        period,
        commissionAmount: parseFloat(commissionAmount),
        grossValue: parseFloat(grossValue || '0'),
        rate: parseFloat(rate || '0'),
        sourceType: sourceType || 'PLACEMENT',
        isManualOverride: true,
        manualOverrideNote: note || 'Manual entry',
        status: 'PENDING',
        createdByUserId: session.user.id,
      },
    })

    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    console.error('Commission POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
