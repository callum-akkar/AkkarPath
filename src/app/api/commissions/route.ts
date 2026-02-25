import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { generateCommissions } from '@/lib/commissions'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period')
    const repId = searchParams.get('repId')

    const where: Record<string, unknown> = {}

    // Non-admins only see their own commissions
    if (user.role !== 'admin' && user.role !== 'manager') {
      where.repId = user.id
    } else if (repId) {
      where.repId = repId
    }

    if (period) {
      where.period = period
    }

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        deal: true,
        rep: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ commissions })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// Generate commissions for a rep/period
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { repId, period } = await req.json()

    if (!repId || !period) {
      return NextResponse.json(
        { error: 'repId and period are required' },
        { status: 400 }
      )
    }

    const commissions = await generateCommissions(repId, period)
    return NextResponse.json({ commissions }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
