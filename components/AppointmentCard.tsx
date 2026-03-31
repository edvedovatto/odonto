'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { cn, formatTime, formatCurrency, formatDate } from '@/lib/utils'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Appointment, AppointmentStatus, PaymentMethod, User } from '@/lib/types'
import { toast } from 'sonner'
import { shareWhatsApp, generateICS } from '@/lib/export'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import NewAppointmentSheet from '@/components/NewAppointmentSheet'

interface Props {
  appointment: Appointment
  onUpdate: (updated: Appointment) => void
  doctors?: User[]
  currentUser?: User | null
  showDate?: boolean
}

const methodLabel: Record<PaymentMethod, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
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
  const [method, setMethod] = useState<PaymentMethod | ''>(apt.payment_method ?? '')
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
    const updates = { payment_status: 'paid' as const, payment_method: method || null, value: numValue }
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
      setMethod('')
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
          isScheduled && 'bg-primary',
          isAttended && 'bg-white border border-border',
          isCancelled && 'bg-white border border-border opacity-70',
        )}
      >
        <div className="flex items-stretch">
          {!isScheduled && (
            <div className={cn('w-1 shrink-0', isAttended && 'bg-green-500', isCancelled && 'bg-red-400')} />
          )}
          <div className="flex-1 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
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
              <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
                {isCancelled && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium border border-red-100">Cancelado</span>}
                {isAttended && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium border border-green-100">Atendido</span>}
                {isScheduled && <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-medium">Agendado</span>}
                {isPaid ? (
                  <span className={cn('text-xs font-semibold', isScheduled ? 'text-white/90' : 'text-green-600')}>
                    {apt.value ? formatCurrency(apt.value) : 'Pago'}
                  </span>
                ) : !isCancelled ? (
                  <span className={cn('text-xs', isScheduled ? 'text-white/50' : 'text-muted-foreground')}>Não pago</span>
                ) : null}
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
            <SheetClose className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </SheetClose>
          </div>

          {/* Editar — só para agendados */}
          {isScheduled && (
            <button
              onClick={() => { setOpen(false); setTimeout(() => setEditOpen(true), 200) }}
              className="w-full h-12 rounded-xl border border-border flex items-center justify-between px-4 mb-6 text-sm font-semibold text-foreground active:bg-muted transition-colors"
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
                      'flex-1 h-12 rounded-xl text-sm font-semibold border transition-all',
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
                      'flex-1 h-12 rounded-xl text-sm font-semibold border transition-all',
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
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1.5">Valor (R$)</p>
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
              <div>
                <p className="text-sm text-muted-foreground mb-1.5">Tipo</p>
                <div className="flex gap-2">
                  {(['pix', 'cash', 'card'] as PaymentMethod[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={cn(
                        'flex-1 h-12 rounded-xl text-sm font-semibold border transition-all',
                        method === m ? 'bg-primary text-white border-primary' : 'bg-background text-muted-foreground border-border'
                      )}
                    >
                      {methodLabel[m]}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full h-12 rounded-xl font-bold" onClick={savePayment} disabled={saving}>
                {saving ? 'Salvando…' : 'Marcar como pago'}
              </Button>
              {isPaid && (
                <button
                  onClick={removePayment}
                  className="w-full text-sm text-muted-foreground underline underline-offset-2 py-1"
                >
                  Remover pagamento
                </button>
              )}
            </div>
          </div>

          {/* Compartilhar */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Compartilhar</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold" onClick={() => shareWhatsApp(apt)}>
                WhatsApp
              </Button>
              <Button variant="outline" className="flex-1 h-12 rounded-xl font-semibold" onClick={() => generateICS(apt)}>
                Calendário
              </Button>
            </div>
          </div>

          {/* Cancelar — só se não estiver cancelado */}
          {!isCancelled && (
            <button
              onClick={() => setCancelConfirmOpen(true)}
              className="w-full h-12 rounded-xl border border-red-200 text-red-500 text-sm font-semibold flex items-center justify-center"
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
