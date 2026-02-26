import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only admins can see plans
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const plans = await prisma.commissionPlan.findMany({
      include: {
        components: { orderBy: [{ type: 'asc' }, { tier: 'asc' }] },
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            components: { select: { id: true, name: true } },
          },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error('Plans GET error:', error)
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
    const { name, description, fiscalYear, currency } = body

    if (!name || !fiscalYear) {
      return NextResponse.json({ error: 'Name and fiscal year are required' }, { status: 400 })
    }

    const plan = await prisma.commissionPlan.create({
      data: {
        name,
        description: description || '',
        fiscalYear,
        currency: currency || 'GBP',
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Plan POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
