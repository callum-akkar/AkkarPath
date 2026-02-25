import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireAuth()

    const where = user.role === 'admin' || user.role === 'manager'
      ? {}
      : { repId: user.id }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        rep: { select: { id: true, name: true, email: true } },
        commissions: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ deals })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { name, amount, status, closeDate, repId } = await req.json()

    const assignedRepId = (user.role === 'admin' || user.role === 'manager')
      ? (repId || user.id)
      : user.id

    const deal = await prisma.deal.create({
      data: {
        name,
        amount: parseFloat(amount),
        status: status || 'open',
        closeDate: closeDate ? new Date(closeDate) : null,
        repId: assignedRepId,
      },
      include: {
        rep: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ deal }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
