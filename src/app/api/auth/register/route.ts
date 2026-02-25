import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { createToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    // First user becomes admin
    const userCount = await prisma.user.count()
    const role = userCount === 0 ? 'admin' : 'rep'

    const user = await prisma.user.create({
      data: { email, name, passwordHash, role },
    })

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
