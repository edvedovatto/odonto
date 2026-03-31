'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, ChevronDown, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Sheet, SheetContent, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import type { Patient, User, Appointment } from '@/lib/types'
import { cn, maskCpf, sanitizeSearch, maskPhoneInput, maskCpfInput } from '@/lib/utils'
import { toast } from 'sonner'
import CalendarInline from '@/components/CalendarInline'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultDate: string
  doctors: User[]
  currentUser: User | null
  onCreated: () => void
  editAppointment?: Appointment
  defaultPatient?: Patient
}

// Horários de 07:30 a 22:45, de 15 em 15 min
const TIME_OPTIONS = (() => {
  const out: { value: string; label: string }[] = []
  for (let t = 7 * 60 + 30; t <= 22 * 60 + 45; t += 15) {
    const s = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    out.push({ value: s, label: s })
  }
  return out
})()

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120].map(d => ({
  value: String(d),
  label: d < 60 ? `${d} min` : `${d / 60}h`,
}))

const DURATION_OPTIONS_LONG = [15, 30, 45, 60, 90, 120].map(d => ({
  value: String(d),
  label: d < 60 ? `${d} minutos` : `${d / 60} hora${d > 60 ? 's' : ''}`,
}))

// ─── CustomSelect — dropdown com portal, totalmente estilizado ────────────────
interface SelectOption { value: string; label: string }

const DropdownList = React.forwardRef<
  HTMLDivElement,
  { style: React.CSSProperties; options: SelectOption[]; value: string; onChange: (v: string) => void }
>(({ style, options, value, onChange }, ref) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showTop,    setShowTop]    = useState(false)
  const [showBottom, setShowBottom] = useState(false)

  function check() {
    const el = scrollRef.current
    if (!el) return
    setShowTop(el.scrollTop > 2)
    setShowBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 2)
  }

  // Verifica após montar (deixa um tick para calcular scrollHeight)
  useEffect(() => { const t = setTimeout(check, 30); return () => clearTimeout(t) }, [])

  return (
    <div ref={ref} style={style}
      className="bg-white border border-border/60 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden">
      <div className="relative">
        {/* Sombra topo — aparece quando tem conteúdo acima */}
        <div className={cn(
          'absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-white to-transparent pointer-events-none z-10 rounded-t-2xl transition-opacity duration-150',
          showTop ? 'opacity-100' : 'opacity-0'
        )} />

        <div ref={scrollRef} onScroll={check}
          className="overflow-y-auto p-1.5" style={{ maxHeight: 240 }}>
          {options.map(opt => (
            <button key={opt.value} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => onChange(opt.value)}
              className={cn(
                'w-full text-left px-3.5 py-3 text-sm rounded-xl transition-colors font-medium',
                opt.value === value ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted/60'
              )}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sombra base — aparece quando tem conteúdo abaixo */}
        <div className={cn(
          'absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none z-10 rounded-b-2xl transition-opacity duration-150',
          showBottom ? 'opacity-100' : 'opacity-0'
        )} />
      </div>
    </div>
  )
})

function CustomSelect({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropRef    = useRef<HTMLDivElement>(null)
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)

  const selected = options.find(o => o.value === value)

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      // Se não cabe abaixo, abre acima
      const spaceBelow = window.innerHeight - r.bottom
      const dropH = Math.min(options.length * 48 + 16, 240)
      const top = spaceBelow < dropH ? r.top - dropH - 6 : r.bottom + 6
      setDropRect({ top, left: r.left, width: r.width })
    }
    setOpen(v => !v)
  }

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      <button ref={triggerRef} type="button" onClick={toggle}
        className={cn(
          'w-full h-12 rounded-xl border bg-background px-4 text-sm',
          'flex items-center justify-between text-left transition-all',
          open
            ? 'border-primary ring-2 ring-primary/20 shadow-sm'
            : 'border-border hover:border-border/80 hover:bg-muted/20',
        )}>
        <span className={cn('flex-1 truncate font-medium', !selected && 'text-muted-foreground font-normal')}>
          {selected?.label ?? placeholder ?? 'Selecione…'}
        </span>
        <ChevronDown className={cn('w-4 h-4 ml-2 shrink-0 text-muted-foreground transition-transform duration-150', open && 'rotate-180')} />
      </button>

      {open && dropRect && typeof document !== 'undefined' && createPortal(
        <DropdownList
          ref={dropRef}
          style={{ position: 'fixed', top: dropRect.top, left: dropRect.left, width: dropRect.width, zIndex: 9999 }}
          options={options}
          value={value}
          onChange={v => { onChange(v); setOpen(false) }}
        />,
        document.body
      )}
    </>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const fieldCls = 'w-full h-12 rounded-xl border border-border bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground'
const labelCls = 'block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2'

function CollapseRow({ icon, label, open, onToggle }: { icon: React.ReactNode; label: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className="w-full h-12 rounded-xl border border-border bg-background px-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
    </button>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function NewAppointmentSheet({ open, onOpenChange, defaultDate, doctors, currentUser, onCreated, editAppointment, defaultPatient }: Props) {
  const supabase = createClient()
  const [isWalkIn,        setIsWalkIn]        = useState(false)
  const [patientSearch,   setPatientSearch]   = useState('')
  const [patientResults,  setPatientResults]  = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showNewPatient,  setShowNewPatient]  = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCpf,   setNewCpf]   = useState('')
  const [date,     setDate]     = useState(defaultDate)
  const [time,     setTime]     = useState('09:00')
  const [duration, setDuration] = useState('30')
  const [doctorId, setDoctorId] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setDate(defaultDate) }, [defaultDate])
  useEffect(() => { if (currentUser?.role === 'dentist') setDoctorId(currentUser.id) }, [currentUser])

  useEffect(() => {
    if (open && editAppointment) {
      setSelectedPatient(editAppointment.patient ?? null)
      setDate(editAppointment.starts_at.slice(0, 10))
      setTime(editAppointment.starts_at.slice(11, 16))
      setDuration(String(editAppointment.duration_minutes))
      setDoctorId(editAppointment.doctor_id)
      setIsWalkIn(false)
    } else if (open && defaultPatient) {
      setSelectedPatient(defaultPatient)
    }
  }, [open, editAppointment, defaultPatient])

  useEffect(() => {
    if (!patientSearch.trim() || selectedPatient) { setPatientResults([]); return }
    clearTimeout(searchRef.current ?? undefined)
    searchRef.current = setTimeout(async () => {
      const { data } = await supabase.from('patients').select('*')
        .or(`name.ilike.%${sanitizeSearch(patientSearch.trim())}%,phone.ilike.%${sanitizeSearch(patientSearch.trim())}%,cpf.ilike.%${sanitizeSearch(patientSearch.trim())}%`)
        .limit(6)
      setPatientResults(data ?? [])
    }, 300)
  }, [patientSearch, selectedPatient, supabase])

  function reset() {
    if (editAppointment) return
    setIsWalkIn(false); setPatientSearch(''); setPatientResults([]); setSelectedPatient(null)
    setShowNewPatient(false); setNewName(''); setNewPhone(''); setNewCpf('')
    setDate(defaultDate); setTime('09:00'); setDuration('30')
    setDoctorId(currentUser?.role === 'dentist' ? currentUser.id : '')
    setSaving(false); setDateOpen(false)
  }

  async function getOrCreatePatient(): Promise<string | null> {
    if (selectedPatient) return selectedPatient.id
    if (showNewPatient && newName.trim().length >= 3) {
      const rawPhone = newPhone.replace(/\D/g, '')
      const rawCpf = newCpf.replace(/\D/g, '') || null
      if (rawPhone.length < 10) { toast.error('Telefone é obrigatório'); return null }
      const { data: mb } = await supabase.from('clinic_members').select('clinic_id')
        .eq('user_id', currentUser?.id ?? '').single()
      const { data, error } = await supabase.from('patients')
        .insert({ name: newName.trim().slice(0, 100), phone: rawPhone, cpf: rawCpf, clinic_id: mb?.clinic_id })
        .select().single()
      if (error) { toast.error('Erro ao criar paciente'); return null }
      return data.id
    }
    toast.error('Selecione ou crie um paciente'); return null
  }

  async function checkConflict(doctorId: string, startsAt: string, durationMin: number, excludeId?: string): Promise<boolean> {
    const startTime = new Date(startsAt)
    const endTime = new Date(startTime.getTime() + durationMin * 60000)

    // Buscar todas as consultas do médico no mesmo dia para calcular próximo horário
    const dayStart = new Date(startTime)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(startTime)
    dayEnd.setHours(23, 59, 59, 999)

    let query = supabase
      .from('appointments')
      .select('id, starts_at, duration_minutes, patient:patients(name)')
      .eq('doctor_id', doctorId)
      .neq('status', 'cancelled')
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString())
      .order('starts_at', { ascending: true })

    if (excludeId) query = query.neq('id', excludeId)

    const { data } = await query
    if (!data) return false

    const conflict = data.find((apt: { starts_at: string; duration_minutes: number }) => {
      const aptStart = new Date(apt.starts_at)
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000)
      return aptEnd > startTime && aptStart < endTime
    })

    if (conflict) {
      const patient = Array.isArray(conflict.patient) ? conflict.patient[0] : conflict.patient
      const patientName = (patient as { name?: string })?.name ?? 'outro paciente'

      // Calcular próximo horário disponível após o conflito
      const conflictEnd = new Date(new Date(conflict.starts_at).getTime() + conflict.duration_minutes * 60000)
      const nextAvailable = new Date(conflictEnd)
      // Arredondar para próximo slot de 15 min
      const mins = nextAvailable.getMinutes()
      const remainder = mins % 15
      if (remainder > 0) nextAvailable.setMinutes(mins + (15 - remainder), 0, 0)

      const nextTime = nextAvailable.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      toast.error(`Conflito com ${patientName}. Próximo horário: ${nextTime}`, { duration: 5000 })
      return true
    }
    return false
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!doctorId) { toast.error('Selecione o médico'); return }
    setSaving(true)

    if (editAppointment) {
      const starts_at = `${date}T${time}:00`
      const hasConflict = await checkConflict(doctorId, new Date(starts_at).toISOString(), parseInt(duration), editAppointment.id)
      if (hasConflict) { setSaving(false); return }
      const { error } = await supabase.from('appointments').update({
        starts_at,
        duration_minutes: parseInt(duration),
        doctor_id: doctorId,
      }).eq('id', editAppointment.id)
      if (error) { toast.error('Erro ao atualizar consulta') }
      else { toast.success('Consulta atualizada'); onCreated(); onOpenChange(false) }
      setSaving(false)
      return
    }

    const startsAt = isWalkIn ? new Date().toISOString() : new Date(`${date}T${time}:00`).toISOString()
    if (!isWalkIn) {
      const hasConflict = await checkConflict(doctorId, startsAt, parseInt(duration))
      if (hasConflict) { setSaving(false); return }
    }

    const patientId = await getOrCreatePatient()
    if (!patientId) { setSaving(false); return }
    const { data: mb } = await supabase.from('clinic_members').select('clinic_id')
      .eq('user_id', currentUser?.id ?? '').single()
    const { error } = await supabase.from('appointments').insert({
      clinic_id: mb?.clinic_id, patient_id: patientId, doctor_id: doctorId,
      starts_at: startsAt, duration_minutes: parseInt(duration),
      status: isWalkIn ? 'attended' : 'scheduled', payment_status: 'unpaid',
    })
    if (error) { toast.error('Erro ao criar consulta') }
    else { toast.success(isWalkIn ? 'Atendimento registrado' : 'Consulta agendada'); onCreated(); onOpenChange(false); reset() }
    setSaving(false)
  }

  const isDentist   = currentUser?.role === 'dentist'
  const hasPatient  = !!selectedPatient || (showNewPatient && newName.trim().length >= 3 && newPhone.replace(/\D/g, '').length >= 10)
  const hasDoctor   = isDentist || !!doctorId
  const isFormValid = hasPatient && hasDoctor

  const datePtBR = new Date(date + 'T12:00:00')
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })

  const doctorOptions = doctors.map(d => ({ value: d.id, label: d.name }))

  return (
    <Sheet open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl max-h-[92dvh] overflow-y-auto px-5 pt-5 pb-8">
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-xl font-bold">
            {editAppointment ? 'Editar consulta' : selectedPatient ? selectedPatient.name : 'Nova consulta'}
          </h2>
          <SheetClose className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </SheetClose>
        </div>

        {/* Tipo */}
        {!editAppointment && (
          <div className="flex gap-1 mb-6 p-1 bg-muted rounded-2xl">
            {([false, true] as const).map(w => (
              <button key={String(w)} type="button" onClick={() => setIsWalkIn(w)}
                className={cn('flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
                  isWalkIn === w ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground')}>
                {w ? 'Imediato' : 'Agendar'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Paciente */}
          <div>
            <label className={labelCls}>Paciente</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-background">
                <p className="font-semibold text-sm truncate">{selectedPatient.name}</p>
                {!editAppointment && (
                  <button type="button"
                    onClick={() => { setSelectedPatient(null); setPatientSearch('') }}
                    className="text-primary text-sm font-semibold shrink-0 ml-3">
                    Trocar
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <input className={fieldCls}
                  placeholder="Nome, telefone ou CPF…"
                  value={patientSearch}
                  onChange={e => { setPatientSearch(e.target.value); setShowNewPatient(false) }}
                  onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)}
                  autoComplete="off" />
                {patientResults.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 z-50 mb-1.5 bg-white border border-border rounded-2xl shadow-xl overflow-hidden max-h-[40vh] overflow-y-auto">
                    {patientResults.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]) }}
                        className="w-full text-left px-4 py-3.5 hover:bg-muted border-b border-border last:border-0">
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.phone}{p.cpf ? ` · ${maskCpf(p.cpf)}` : ''}</p>
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => { setShowNewPatient(true); setPatientResults([]); setNewName(patientSearch) }}
                      className="w-full text-left px-4 py-3.5 text-sm text-primary font-semibold hover:bg-muted">
                      + Criar &ldquo;{patientSearch}&rdquo;
                    </button>
                  </div>
                )}
                {patientSearch.trim() && patientResults.length === 0 && !showNewPatient && (
                  <button type="button"
                    onClick={() => { setShowNewPatient(true); setNewName(patientSearch) }}
                    className="mt-2 text-sm text-primary font-semibold">
                    + Criar novo paciente
                  </button>
                )}
              </div>
            )}

            {showNewPatient && !selectedPatient && (
              <div className="mt-3 border border-border rounded-2xl overflow-hidden bg-background">
                <div className="px-4 py-2 bg-muted border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Novo paciente</p>
                </div>
                <div className="p-3 space-y-2">
                  <input className={fieldCls} placeholder="Nome completo *" value={newName}
                    onChange={e => setNewName(e.target.value.slice(0, 100))} maxLength={100}
                    onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} />
                  <input className={fieldCls} placeholder="Telefone *" value={newPhone}
                    onChange={e => setNewPhone(maskPhoneInput(e.target.value))} type="tel" inputMode="tel"
                    onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} />
                  <input className={fieldCls} placeholder="CPF (opcional)" value={newCpf}
                    onChange={e => setNewCpf(maskCpfInput(e.target.value))} inputMode="numeric" maxLength={14}
                    onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)} />
                </div>
              </div>
            )}
          </div>

          {/* Médico */}
          {!isDentist && doctors.length > 0 && (
            <div>
              <label className={labelCls}>Médico</label>
              <CustomSelect
                value={doctorId}
                onChange={setDoctorId}
                options={doctorOptions}
                placeholder="Selecione o médico…"
              />
            </div>
          )}

          {/* Data */}
          {!isWalkIn && (
            <div>
              <label className={labelCls}>Data</label>
              <CollapseRow
                icon={<Calendar className="w-4 h-4" />}
                label={datePtBR}
                open={dateOpen}
                onToggle={() => setDateOpen(v => !v)}
              />
              {dateOpen && (
                <div className="mt-2 border border-border rounded-2xl px-4 pb-4 bg-background">
                  <CalendarInline value={date} onChange={v => { setDate(v); setDateOpen(false) }} />
                </div>
              )}
            </div>
          )}

          {/* Hora + Duração lado a lado */}
          {!isWalkIn && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>Hora</label>
                <CustomSelect value={time} onChange={setTime} options={TIME_OPTIONS} />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Duração</label>
                <CustomSelect value={duration} onChange={setDuration} options={DURATION_OPTIONS} />
              </div>
            </div>
          )}

          {/* Duração sozinha no walk-in */}
          {isWalkIn && (
            <div>
              <label className={labelCls}>Duração</label>
              <CustomSelect value={duration} onChange={setDuration} options={DURATION_OPTIONS_LONG} />
            </div>
          )}

          <Button type="submit" className="w-full h-12 text-base font-bold rounded-2xl" disabled={saving || !isFormValid}>
            {saving ? 'Salvando…' : editAppointment ? 'Salvar alterações' : isWalkIn ? 'Registrar atendimento' : 'Agendar consulta'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
