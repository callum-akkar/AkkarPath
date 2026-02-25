import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// Bulk approve or mark as paid
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { ids, status } = await req.json()

    if (!ids || !Array.isArray(ids) || !status) {
      return NextResponse.json({ error: 'ids array and status are required' }, { status: 400 })
    }

    await prisma.commission.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    return NextResponse.json({ success: true, updated: ids.length })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
