'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, formatTime, formatCurrency, formatDate } from '@/lib/utils'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Appointment, AppointmentStatus, User } from '@/lib/types'
import { toast } from 'sonner'
import { shareWhatsApp } from '@/lib/export'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import NewAppointmentSheet from '@/components/NewAppointmentSheet'

interface Props {
  appointment: Appointment
  onUpdate: (updated: Appointment) => void
  doctors?: User[]
  currentUser?: User | null
  showDate?: boolean
}

export default function AppointmentCard({ appointment: initial, onUpdate, doctors, currentUser, showDate }: Props) {
  const [apt, setApt] = useState(initial)
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [payValue, setPayValue] = useState(
    apt.value != null
      ? apt.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ''
  )
  const [saving, setSaving] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)

  async function updateStatus(status: AppointmentStatus) {
    const supabase = createClient()
    const prev = apt
    const updated = { ...apt, status }
    setApt(updated)
    onUpdate(updated)
    const { error } = await supabase.from('appointments').update({ status }).eq('id', apt.id)
    if (error) {
      toast.error('Erro ao atualizar status')
      setApt(prev)
      onUpdate(prev)
    }
  }

  async function savePayment() {
    setSaving(true)
    const supabase = createClient()
    const numValue = payValue ? parseFloat(payValue.replace(/\./g, '').replace(',', '.')) : null
    const updates = { payment_status: 'paid' as const, payment_method: null, value: numValue }
    const { error } = await supabase.from('appointments').update(updates).eq('id', apt.id)
    if (error) {
      toast.error('Erro ao salvar pagamento')
    } else {
      const updated = { ...apt, ...updates }
      setApt(updated)
      onUpdate(updated)
      toast.success('Pagamento registrado')
      setOpen(false)
    }
    setSaving(false)
  }

  async function removePayment() {
    const supabase = createClient()
    const updates = { payment_status: 'unpaid' as const, payment_method: null, value: null }
    const { error } = await supabase.from('appointments').update(updates).eq('id', apt.id)
    if (error) {
      toast.error('Erro ao remover pagamento')
    } else {
      const updated = { ...apt, ...updates }
      setApt(updated)
      onUpdate(updated)
      setPayValue('')
    }
  }

  async function togglePaidInline(e: React.MouseEvent) {
    e.stopPropagation()
    const supabase = createClient()
    if (isPaid) {
      const updates = { payment_status: 'unpaid' as const, payment_method: null, value: null }
      const { error } = await supabase.from('appointments').update(updates).eq('id', apt.id)
      if (!error) { setApt({ ...apt, ...updates }); onUpdate({ ...apt, ...updates }); setPayValue('') }
    } else {
      const updates = { payment_status: 'paid' as const, payment_method: null, value: null }
      const { error } = await supabase.from('appointments').update(updates).eq('id', apt.id)
      if (!error) { setApt({ ...apt, ...updates }); onUpdate({ ...apt, ...updates }) }
    }
  }

  const isPaid = apt.payment_status === 'paid'
  const isAttended = apt.status === 'attended'
  const isCancelled = apt.status === 'cancelled'
  const isScheduled = apt.status === 'scheduled'

  return (
    <>
      {/* Card */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'w-full text-left rounded-2xl overflow-hidden shadow-sm active:scale-[0.98] transition-transform',
          isScheduled && 'bg-primary border border-white/20',
          isAttended && 'bg-white border border-border',
          isCancelled && 'bg-white border border-border opacity-70',
        )}
      >
        <div className="flex items-stretch">
          {!isScheduled && (
            <div className={cn('w-1 shrink-0', isAttended && 'bg-green-500', isCancelled && 'bg-red-400')} />
          )}
          <div className="flex-1 min-w-0 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className={cn('text-xs font-medium tabular-nums mb-1', isScheduled ? 'text-white/60' : 'text-muted-foreground')}>
                  {showDate ? `${formatDate(apt.starts_at)} · ` : ''}{formatTime(apt.starts_at)} · {apt.duration_minutes} min
                </p>
                <p className={cn('font-semibold text-[15px] leading-snug truncate', isScheduled ? 'text-white' : 'text-foreground')}>
                  {apt.patient?.name ?? '—'}
                </p>
                <p className={cn('text-sm truncate mt-0.5', isScheduled ? 'text-white/65' : 'text-muted-foreground')}>
                  {apt.doctor?.name ?? '—'}
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                {/* Status com círculo toggle */}
                <div className="flex items-center gap-1.5">
                  {isCancelled && <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-500 font-medium border border-red-100">Cancelado</span>}
                  {isAttended && <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 font-medium border border-green-100">Atendido</span>}
                  {isScheduled && <span className="text-xs px-2 py-1 rounded-full bg-white/20 text-white font-medium">Agendado</span>}
                  {!isCancelled && (
                    <button
                      onClick={e => { e.stopPropagation(); updateStatus(isAttended ? 'scheduled' : 'attended') }}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                        isAttended ? 'bg-green-500 border-green-500' : isScheduled ? 'border-white/50' : 'border-border',
                      )}
                    >
                      {isAttended && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>
                      )}
                    </button>
                  )}
                </div>
                {/* Pagamento com círculo toggle */}
                {!isCancelled && (
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs font-medium',
                      isPaid ? isScheduled ? 'text-white' : 'text-green-600' : isScheduled ? 'text-white/50' : 'text-muted-foreground'
                    )}>
                      {isPaid ? (apt.value ? formatCurrency(apt.value) : 'Pago') : 'Não pago'}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); togglePaidInline(e) }}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                        isPaid ? isScheduled ? 'bg-white border-white' : 'bg-green-500 border-green-500' : isScheduled ? 'border-white/50' : 'border-border',
                      )}
                    >
                      {isPaid && (
                        <svg xmlns="http://www.w3.org/2000/svg" className={cn('w-3 h-3', isScheduled ? 'text-primary' : 'text-white')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M20 6L9 17l-5-5" /></svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Sheet de detalhes */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl max-h-[92dvh] overflow-y-auto px-5 pt-5 pb-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1 pr-3">
              <h2 className="text-xl font-bold">{apt.patient?.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDate(apt.starts_at)} · {formatTime(apt.starts_at)} · {apt.duration_minutes} min · {apt.doctor?.name}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => shareWhatsApp(apt)}
                className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white active:bg-green-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </button>
              <SheetClose className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </SheetClose>
            </div>
          </div>

          {/* Editar — só para agendados */}
          {isScheduled && (
            <button
              onClick={() => { setOpen(false); setTimeout(() => setEditOpen(true), 200) }}
              className="w-full min-h-[56px] rounded-2xl bg-muted flex items-center justify-between px-5 mb-6 text-sm font-semibold text-foreground active:bg-muted/70 transition-colors"
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar agendamento
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}

          {/* Status */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Status</p>
            {isCancelled ? (
              <div className="flex gap-2">
                {(['scheduled', 'attended', 'cancelled'] as AppointmentStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    className={cn(
                      'flex-1 h-14 rounded-2xl text-sm font-semibold border transition-all',
                      apt.status === s
                        ? s === 'attended' ? 'bg-green-500 text-white border-green-500'
                          : s === 'cancelled' ? 'bg-red-500 text-white border-red-500'
                          : 'bg-primary text-white border-primary'
                        : 'bg-background text-muted-foreground border-border'
                    )}
                  >
                    {s === 'scheduled' ? 'Agendado' : s === 'attended' ? 'Atendido' : 'Cancelado'}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                {(['scheduled', 'attended'] as AppointmentStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    className={cn(
                      'flex-1 h-14 rounded-2xl text-sm font-semibold border transition-all',
                      apt.status === s
                        ? s === 'attended' ? 'bg-green-500 text-white border-green-500' : 'bg-primary text-white border-primary'
                        : 'bg-background text-muted-foreground border-border'
                    )}
                  >
                    {s === 'scheduled' ? 'Agendado' : 'Atendido'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagamento */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Pagamento</p>
            {isPaid ? (
              <div>
                <div className="rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-green-700">Pago</p>
                    {apt.value && <p className="text-sm text-green-600">{formatCurrency(apt.value)}</p>}
                  </div>
                </div>
                <button
                  onClick={removePayment}
                  className="w-full mt-2 text-sm text-muted-foreground underline underline-offset-2 py-1"
                >
                  Remover pagamento
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1.5">Valor (R$) — opcional</p>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={payValue}
                    onChange={e => {
                      let raw = e.target.value.replace(/[^\d,]/g, '')
                      const commaIdx = raw.indexOf(',')
                      if (commaIdx !== -1) {
                        raw = raw.slice(0, commaIdx + 1) + raw.slice(commaIdx + 1).replace(/,/g, '').slice(0, 2)
                      }
                      const [intPart = '', decPart] = raw.split(',')
                      const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                      setPayValue(decPart !== undefined ? `${formatted},${decPart}` : formatted)
                    }}
                    inputMode="decimal"
                    className="h-12 rounded-xl text-sm font-medium"
                    onFocus={e => setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)}
                    onBlur={() => {
                      if (payValue && !payValue.includes(',')) setPayValue(payValue + ',00')
                    }}
                  />
                </div>
                <Button className="w-full h-14 rounded-2xl font-bold" onClick={savePayment} disabled={saving}>
                  {saving ? 'Salvando…' : 'Marcar como pago'}
                </Button>
              </div>
            )}
          </div>


          {/* Cancelar — só se não estiver cancelado */}
          {!isCancelled && (
            <button
              onClick={() => setCancelConfirmOpen(true)}
              className="w-full min-h-[56px] rounded-2xl bg-red-50 border border-red-200 text-red-500 text-sm font-semibold flex items-center justify-center active:bg-red-100 transition-colors"
            >
              Cancelar consulta
            </button>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmação de cancelamento */}
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Cancelar consulta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar a consulta de <strong>{apt.patient?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="flex-1 h-11 rounded-xl font-semibold"
              onClick={() => setCancelConfirmOpen(false)}
            >
              Não, manter
            </Button>
            <Button
              variant="destructive"
              className="flex-1 h-11 rounded-xl font-semibold"
              onClick={() => {
                updateStatus('cancelled')
                setCancelConfirmOpen(false)
                setOpen(false)
              }}
            >
              Sim, cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <NewAppointmentSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        defaultDate={apt.starts_at.slice(0, 10)}
        doctors={doctors ?? []}
        currentUser={currentUser ?? null}
        editAppointment={apt}
        onCreated={async () => {
          const supabase = createClient()
          const { data } = await supabase
            .from('appointments')
            .select('*, patient:patients(id, name, phone, cpf, photo_url), doctor:users(id, name, email, role)')
            .eq('id', apt.id)
            .single()
          if (data) {
            setApt(data as Appointment)
            onUpdate(data as Appointment)
          }
        }}
      />
    </>
  )
}
