import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={{ id: user.id, name: user.name, email: user.email, role: user.role }} />
      <main className="pl-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
