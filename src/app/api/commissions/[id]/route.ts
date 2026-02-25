import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { status } = await req.json()

    const commission = await prisma.commission.update({
      where: { id },
      data: { status },
      include: {
        deal: true,
        rep: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ commission })
  } catch {
    return NextResponse.json({ error: 'Error updating commission' }, { status: 400 })
  }
}
