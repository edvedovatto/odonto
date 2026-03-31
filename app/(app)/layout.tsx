export const dynamic = 'force-dynamic'

import BottomNav from '@/components/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <main className="flex-1 pb-20 animate-in fade-in duration-200">{children}</main>
      <BottomNav />
    </div>
  )
}
