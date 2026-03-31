'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import AppointmentCard from '@/components/AppointmentCard'
import type { Appointment, User } from '@/lib/types'

const PAGE_SIZE = 20

type DoctorFilter = string // 'all' | doctor_id
type PaymentFilter = 'all' | 'paid' | 'unpaid'

export default function HistoryPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorFilter>('all')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // KPIs do mês atual
  const [kpis, setKpis] = useState({ attended: 0, revenue: 0, unpaid: 0 })

  const loadUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('clinic_members')
      .select('role, user:users(id, name, email, role)')
      .eq('user_id', user.id)
      .single()
    if (data?.user) {
      const u = Array.isArray(data.user) ? data.user[0] : data.user
      setCurrentUser({ ...u, role: data.role } as User)
    }
  }, [supabase])

  const loadDoctors = useCallback(async () => {
    const { data } = await supabase
      .from('clinic_members')
      .select('user:users(id, name, email, role)')
      .eq('role', 'dentist')
    if (data) {
      setDoctors(data.map((d: { user: User | User[] }) => {
        const u = Array.isArray(d.user) ? d.user[0] : d.user
        return u as User
      }).filter(Boolean))
    }
  }, [supabase])

  const loadKpis = useCallback(async () => {
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}T23:59:59`

    const { data } = await supabase
      .from('appointments')
      .select('status, payment_status, value')
      .gte('starts_at', monthStart)
      .lte('starts_at', monthEndStr)
      .neq('status', 'cancelled')

    if (data) {
      type KpiRow = { status: string; payment_status: string; value: number | null }
      const attended = data.filter((a: KpiRow) => a.status === 'attended').length
      const revenue = data.filter((a: KpiRow) => a.payment_status === 'paid').reduce((sum: number, a: KpiRow) => sum + (a.value ?? 0), 0)
      const unpaid = data.filter((a: KpiRow) => a.payment_status === 'unpaid' && a.status === 'attended').length
      setKpis({ attended, revenue, unpaid })
    }
  }, [supabase])

  const loadAppointments = useCallback(async (offset: number, reset = false) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    let query = supabase
      .from('appointments')
      .select('*, patient:patients(id, name, phone, cpf, photo_url), doctor:users(id, name, email, role)')
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (currentUser?.role === 'dentist') {
      query = query.eq('doctor_id', currentUser.id)
    } else if (selectedDoctor !== 'all') {
      query = query.eq('doctor_id', selectedDoctor)
    }

    if (paymentFilter === 'paid') query = query.eq('payment_status', 'paid')
    if (paymentFilter === 'unpaid') query = query.eq('payment_status', 'unpaid')

    const { data } = await query

    const newData = (data as Appointment[]) ?? []
    if (reset) {
      setAppointments(newData)
    } else {
      setAppointments(prev => [...prev, ...newData])
    }
    setHasMore(newData.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [supabase, currentUser, selectedDoctor, paymentFilter])

  useEffect(() => { loadUser() }, [loadUser])
  useEffect(() => { if (currentUser) { loadDoctors(); loadKpis() } }, [currentUser, loadDoctors, loadKpis])
  useEffect(() => {
    if (currentUser) loadAppointments(0, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, selectedDoctor, paymentFilter])

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || loading) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadAppointments(appointments.length)
      }
    }, { rootMargin: '200px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadingMore, loading, appointments.length])

  function handleUpdate(updated: Appointment) {
    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))
    loadKpis()
  }

  // Agrupar por dia
  const grouped: { date: string; label: string; items: Appointment[] }[] = []
  for (const apt of appointments) {
    const date = apt.starts_at.slice(0, 10)
    const last = grouped[grouped.length - 1]
    if (last?.date === date) {
      last.items.push(apt)
    } else {
      const d = new Date(date + 'T12:00:00')
      const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
      grouped.push({ date, label, items: [apt] })
    }
  }

  const isDentist = currentUser?.role === 'dentist'
  const now = new Date()
  const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const paymentOptions: { value: PaymentFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'paid', label: 'Pagos' },
    { value: 'unpaid', label: 'Não pagos' },
  ]

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="px-5 pt-14 pb-5 bg-primary text-white">
        <h1 className="text-[2rem] font-bold tracking-tight leading-tight">Histórico</h1>
        <p className="text-white/55 text-sm mt-1 capitalize">{monthLabel}</p>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2.5 mt-4">
          <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold">{kpis.attended}</p>
            <p className="text-[11px] text-white/60 font-medium">Atendidos</p>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold">{formatCurrency(kpis.revenue).replace('R$\u00a0', 'R$ ')}</p>
            <p className="text-[11px] text-white/60 font-medium">Recebido</p>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-red-300">{kpis.unpaid}</p>
            <p className="text-[11px] text-white/60 font-medium">Não pagos</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-5 py-3 space-y-2 bg-white border-b border-border">
        {/* Médico */}
        {!isDentist && doctors.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setSelectedDoctor('all')}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors',
                selectedDoctor === 'all' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              )}
            >
              Todos
            </button>
            {doctors.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDoctor(d.id)}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors',
                  selectedDoctor === d.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                )}
              >
                {d.name.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Pagamento */}
        <div className="flex gap-2">
          {paymentOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPaymentFilter(opt.value)}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors',
                paymentFilter === opt.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-[76px] rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <p className="font-bold text-foreground mb-1">Nenhum atendimento</p>
            <p className="text-sm text-muted-foreground">Sem resultados para os filtros selecionados</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(group => (
              <div key={group.date}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1 capitalize">
                  {group.label}
                </p>
                <div className="space-y-2.5">
                  {group.items.map(apt => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onUpdate={handleUpdate}
                      doctors={doctors}
                      currentUser={currentUser}
                      showDate
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Sentinel para infinite scroll */}
            <div ref={sentinelRef} className="h-1" />

            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!hasMore && appointments.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Fim do histórico
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
