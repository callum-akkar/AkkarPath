import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const { targetAmount } = await req.json()

    const quota = await prisma.quotaTarget.update({
      where: { id },
      data: { targetAmount: parseFloat(targetAmount) },
      include: {
        rep: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ quota })
  } catch {
    return NextResponse.json({ error: 'Error updating quota' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params

    await prisma.quotaTarget.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error deleting quota' }, { status: 400 })
  }
}
