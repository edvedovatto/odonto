'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, formatCurrency } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import AppointmentCard from '@/components/AppointmentCard'
import type { Appointment, User } from '@/lib/types'

const PAGE_SIZE = 20
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type PaymentFilter = 'all' | 'paid' | 'unpaid'

export default function HistoryPage() {
  const supabase = createClient()

  // Mês selecionado
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [selectedDoctor, setSelectedDoctor] = useState('all')
  const [doctorOpen, setDoctorOpen] = useState(false)
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all')
  const sentinelRef = useRef<HTMLDivElement>(null)

  // KPIs
  const [kpis, setKpis] = useState({ total: 0, attended: 0, revenue: 0, unpaid: 0, unpaidValue: 0 })

  // Helpers de range do mês
  const monthStart = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01T00:00:00`
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate()
  const monthEnd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

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
    let query = supabase
      .from('appointments')
      .select('status, payment_status, value')
      .gte('starts_at', monthStart)
      .lte('starts_at', monthEnd)
      .neq('status', 'cancelled')

    if (currentUser?.role === 'dentist') {
      query = query.eq('doctor_id', currentUser.id)
    } else if (selectedDoctor !== 'all') {
      query = query.eq('doctor_id', selectedDoctor)
    }

    const { data } = await query
    if (data) {
      type KpiRow = { status: string; payment_status: string; value: number | null }
      const total = data.length
      const attended = data.filter((a: KpiRow) => a.status === 'attended').length
      const revenue = data.filter((a: KpiRow) => a.payment_status === 'paid').reduce((sum: number, a: KpiRow) => sum + (a.value ?? 0), 0)
      const unpaidItems = data.filter((a: KpiRow) => a.payment_status === 'unpaid' && a.status === 'attended')
      const unpaid = unpaidItems.length
      const unpaidValue = unpaidItems.reduce((sum: number, a: KpiRow) => sum + (a.value ?? 0), 0)
      setKpis({ total, attended, revenue, unpaid, unpaidValue })
    }
  }, [supabase, monthStart, monthEnd, currentUser, selectedDoctor])

  const loadAppointments = useCallback(async (offset: number, reset = false) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    let query = supabase
      .from('appointments')
      .select('*, patient:patients(id, name, phone, cpf, photo_url), doctor:users(id, name, email, role)')
      .gte('starts_at', monthStart)
      .lte('starts_at', monthEnd)
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
    if (reset) setAppointments(newData)
    else setAppointments(prev => [...prev, ...newData])
    setHasMore(newData.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [supabase, currentUser, selectedDoctor, paymentFilter, monthStart, monthEnd])

  useEffect(() => { loadUser() }, [loadUser])
  useEffect(() => { if (currentUser) loadDoctors() }, [currentUser, loadDoctors])
  useEffect(() => {
    if (currentUser) { loadKpis(); loadAppointments(0, true) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, selectedDoctor, paymentFilter, viewYear, viewMonth])

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
  const selectedDoctorName = selectedDoctor === 'all' ? 'Todos os médicos' : doctors.find(d => d.id === selectedDoctor)?.name ?? ''

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

        {/* Navegação por mês */}
        <div className="flex items-center justify-between mt-3">
          <button onClick={prevMonth} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 active:bg-white/25">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="font-bold text-base">{MONTHS_PT[viewMonth]} {viewYear}</p>
          <button onClick={nextMonth} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 active:bg-white/25">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <div className="bg-white/15 rounded-xl px-3 py-3">
            <p className="text-2xl font-bold">{kpis.total}</p>
            <p className="text-[11px] text-white/60 font-medium mt-0.5">Consultas no mês</p>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-3">
            <p className="text-2xl font-bold">{kpis.attended}</p>
            <p className="text-[11px] text-white/60 font-medium mt-0.5">Atendidas</p>
          </div>
          <div className="bg-green-500/20 rounded-xl px-3 py-3">
            <p className="text-2xl font-bold">{formatCurrency(kpis.revenue)}</p>
            <p className="text-[11px] text-white/60 font-medium mt-0.5">Recebido</p>
          </div>
          <div className="bg-red-500/20 rounded-xl px-3 py-3">
            <p className="text-2xl font-bold">{kpis.unpaid}</p>
            <p className="text-[11px] text-white/60 font-medium mt-0.5">Não pagos</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-5 py-3 space-y-2.5 bg-white border-b border-border">
        {/* Médico — dropdown */}
        {!isDentist && doctors.length > 1 && (
          <div className="relative">
            <button
              onClick={() => setDoctorOpen(v => !v)}
              className="w-full h-11 rounded-xl border border-border bg-background px-4 text-sm font-medium flex items-center justify-between"
            >
              <span>{selectedDoctorName}</span>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', doctorOpen && 'rotate-180')} />
            </button>
            {doctorOpen && (
              <div className="mt-1.5 border border-border rounded-xl bg-white overflow-hidden">
                <button
                  onClick={() => { setSelectedDoctor('all'); setDoctorOpen(false) }}
                  className={cn('w-full text-left px-4 py-3 text-sm font-medium border-b border-border', selectedDoctor === 'all' && 'bg-muted')}
                >
                  Todos os médicos
                </button>
                {doctors.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDoctor(d.id); setDoctorOpen(false) }}
                    className={cn('w-full text-left px-4 py-3 text-sm font-medium border-b border-border last:border-0', selectedDoctor === d.id && 'bg-muted')}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pagamento */}
        <div className="flex gap-2">
          {paymentOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPaymentFilter(opt.value)}
              className={cn(
                'flex-1 py-2 rounded-xl text-sm font-semibold transition-colors',
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
            <p className="text-sm text-muted-foreground">Sem resultados para {MONTHS_PT[viewMonth]}</p>
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
