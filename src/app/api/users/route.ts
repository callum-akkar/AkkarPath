import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    await requireAuth()

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        planId: true,
        plan: { select: { id: true, name: true } },
        createdAt: true,
        _count: {
          select: { deals: true, commissions: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// Admin creates a new team member
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const { email, name, password, role, planId } = await req.json()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: role || 'rep',
        planId: planId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        planId: true,
      },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
