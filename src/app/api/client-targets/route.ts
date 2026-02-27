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
    const userId = req.nextUrl.searchParams.get('userId') || ''

    const where: Record<string, unknown> = {}
    if (fiscalYear) {
      where.period = { startsWith: fiscalYear }
    }
    if (userId) {
      where.userId = userId
    }

    const targets = await prisma.clientTarget.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        account: { select: { id: true, salesforceId: true, name: true } },
      },
      orderBy: [{ user: { name: 'asc' } }, { account: { name: 'asc' } }, { period: 'asc' }],
    })

    return NextResponse.json(targets)
  } catch (error) {
    console.error('Client targets GET error:', error)
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
    const { userId, accountId, period, nfiTargetGBP } = body

    if (!userId || !accountId || !period || nfiTargetGBP === undefined) {
      return NextResponse.json({ error: 'userId, accountId, period, and nfiTargetGBP are required' }, { status: 400 })
    }

    const target = await prisma.clientTarget.upsert({
      where: { userId_accountId_period: { userId, accountId, period } },
      update: { nfiTargetGBP },
      create: {
        userId,
        accountId,
        period,
        nfiTargetGBP,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        account: { select: { id: true, salesforceId: true, name: true } },
      },
    })

    return NextResponse.json(target)
  } catch (error) {
    console.error('Client targets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
