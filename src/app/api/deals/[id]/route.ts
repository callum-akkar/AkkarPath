import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params
    const data = await req.json()

    const updateData: Record<string, unknown> = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.amount !== undefined) updateData.amount = parseFloat(data.amount)
    if (data.status !== undefined) updateData.status = data.status
    if (data.closeDate !== undefined) updateData.closeDate = data.closeDate ? new Date(data.closeDate) : null
    if (data.repId !== undefined) updateData.repId = data.repId

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        rep: { select: { id: true, name: true, email: true } },
        commissions: true,
      },
    })

    return NextResponse.json({ deal })
  } catch {
    return NextResponse.json({ error: 'Error updating deal' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth()
    const { id } = await params

    await prisma.deal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error deleting deal' }, { status: 400 })
  }
}
