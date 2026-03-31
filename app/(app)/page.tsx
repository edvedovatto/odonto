'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { todayISO } from '@/lib/utils'
import AppointmentCard from '@/components/AppointmentCard'
import NewAppointmentSheet from '@/components/NewAppointmentSheet'
import type { Appointment, User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import CalendarInline from '@/components/CalendarInline'

interface UpcomingDay {
  date: string
  count: number
  names: string[]
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<User[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<string>('all')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [date, setDate] = useState(todayISO())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [upcomingDays, setUpcomingDays] = useState<UpcomingDay[]>([])

  const supabase = createClient()

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

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    const start = `${date}T00:00:00`
    const end = `${date}T23:59:59`
    let query = supabase
      .from('appointments')
      .select('*, patient:patients(id, name, phone, cpf, photo_url), doctor:users(id, name, email, role)')
      .gte('starts_at', start)
      .lte('starts_at', end)
      .order('starts_at', { ascending: true })
    if (currentUser?.role === 'dentist') {
      query = query.eq('doctor_id', currentUser.id)
    } else if (selectedDoctor !== 'all') {
      query = query.eq('doctor_id', selectedDoctor)
    }
    const { data } = await query
    setAppointments((data as Appointment[]) ?? [])
    setLoading(false)
  }, [supabase, date, currentUser, selectedDoctor])

  const loadUpcoming = useCallback(async () => {
    const toDate = new Date(date + 'T12:00:00')
    toDate.setDate(toDate.getDate() + 7)
    const to = toDate.toISOString().slice(0, 10)

    let query = supabase
      .from('appointments')
      .select('starts_at, patient:patients(name)')
      .gt('starts_at', `${date}T23:59:59`)
      .lte('starts_at', `${to}T23:59:59`)
      .neq('status', 'cancelled')
      .order('starts_at')

    if (currentUser?.role === 'dentist') {
      query = query.eq('doctor_id', currentUser.id)
    } else if (selectedDoctor !== 'all') {
      query = query.eq('doctor_id', selectedDoctor)
    }

    const { data } = await query
    if (!data) return

    const grouped: Record<string, string[]> = {}
    for (const apt of data) {
      const d = (apt.starts_at as string).slice(0, 10)
      if (!grouped[d]) grouped[d] = []
      const patient = Array.isArray(apt.patient) ? apt.patient[0] : apt.patient
      if ((patient as { name?: string })?.name) grouped[d].push((patient as { name: string }).name)
    }

    setUpcomingDays(
      Object.entries(grouped).map(([d, names]) => ({ date: d, count: names.length, names }))
    )
  }, [supabase, date, currentUser, selectedDoctor])

  useEffect(() => { loadUser() }, [loadUser])
  useEffect(() => { if (currentUser) { loadDoctors(); loadAppointments() } }, [currentUser, loadDoctors, loadAppointments])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (currentUser) loadAppointments() }, [date, selectedDoctor])

  useEffect(() => {
    if (!loading && currentUser) loadUpcoming()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentUser, date])

  function handleUpdate(updated: Appointment) {
    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))
  }

  const isToday = date === todayISO()
  const isDentist = currentUser?.role === 'dentist'
  const dateObj = new Date(date + 'T12:00:00')
  const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })
  const dayMonth = dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
  const dateFormatted = date.split('-').reverse().join('/')

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="px-5 pt-14 pb-5 bg-primary text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/55 text-sm font-medium capitalize tracking-wide">{weekday}</p>
            <h1 className="text-[2rem] font-bold tracking-tight mt-0.5 leading-tight">{dayMonth}</h1>
            <p className="text-white/55 text-sm mt-1">
              {loading ? '…' : appointments.length === 0 ? 'Sem consultas' : `${appointments.length} consulta${appointments.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            onClick={() => setNewOpen(true)}
            className="bg-white text-primary hover:bg-white/90 font-bold rounded-2xl h-11 px-5 shrink-0 shadow-sm mt-1"
          >
            + Nova
          </Button>
        </div>

        {/* Navegação de data */}
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setCalendarOpen(v => !v)}
            className="flex-1 h-10 rounded-xl px-3 text-sm bg-white/15 text-white flex items-center gap-2 active:bg-white/25 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {dateFormatted}
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 ml-auto opacity-50 transition-transform duration-200 ${calendarOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {!isToday && (
            <button
              onClick={() => { setDate(todayISO()); setCalendarOpen(false) }}
              className="h-10 px-4 rounded-xl bg-white/20 text-white text-sm font-semibold shrink-0"
            >
              Hoje
            </button>
          )}

          {/* Calendário flutuante */}
          {calendarOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setCalendarOpen(false)} />
              <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] px-4 pb-4">
                <CalendarInline value={date} onChange={v => { setDate(v); setCalendarOpen(false) }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filtro por médico */}
      {!isDentist && doctors.length > 1 && (
        <div className="flex gap-2 px-5 py-3 overflow-x-auto scrollbar-none bg-white border-b border-border">
          <button
            onClick={() => setSelectedDoctor('all')}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              selectedDoctor === 'all'
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            Todos
          </button>
          {doctors.map(d => (
            <button
              key={d.id}
              onClick={() => setSelectedDoctor(d.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                selectedDoctor === d.id
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {d.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="px-4 py-4 space-y-2.5">
        {loading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[76px] rounded-2xl bg-muted animate-pulse" />
            ))}
          </>
        ) : appointments.length === 0 ? (
          <>
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </div>
              <p className="font-bold text-foreground mb-1">Nenhuma consulta</p>
              <p className="text-sm text-muted-foreground">Sem agendamentos para este dia</p>
            </div>
          </>
        ) : (
          appointments.map(apt => (
            <AppointmentCard key={apt.id} appointment={apt} onUpdate={handleUpdate} doctors={doctors} currentUser={currentUser} />
          ))
        )}
      </div>

      {/* Próximos atendimentos — sempre visível */}
      {!loading && upcomingDays.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">Próximos atendimentos</p>
          <div className="space-y-2">
            {upcomingDays.map(day => {
              const d = new Date(day.date + 'T12:00:00')
              const label = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
              const preview = day.names.slice(0, 2).join(', ') + (day.names.length > 2 ? ` +${day.names.length - 2}` : '')
              return (
                <button
                  key={day.date}
                  onClick={() => setDate(day.date)}
                  className="w-full text-left rounded-2xl bg-white border border-border px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-sm capitalize">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{preview}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-1">
                    {day.count} consulta{day.count !== 1 ? 's' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <NewAppointmentSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultDate={date}
        doctors={doctors}
        currentUser={currentUser}
        onCreated={loadAppointments}
      />
    </div>
  )
}
