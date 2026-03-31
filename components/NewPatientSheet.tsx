'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn, maskPhoneInput, maskCpfInput } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
  defaultName?: string
}

const fieldCls = 'w-full h-12 rounded-xl border border-border bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground'
const labelCls = 'block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2'

export default function NewPatientSheet({ open, onOpenChange, onCreated, defaultName = '' }: Props) {
  const supabase = createClient()
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')

  function reset() {
    setName(defaultName)
    setPhone('')
    setCpf('')
    setSaving(false)
    setNameError('')
    setPhoneError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    let valid = true
    if (name.trim().length < 3) { setNameError('Nome deve ter pelo menos 3 caracteres'); valid = false }
    if (phone.replace(/\D/g, '').length < 10) { setPhoneError('Telefone é obrigatório'); valid = false }
    if (!valid) return
    setNameError('')
    setPhoneError('')
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: member } = await supabase
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', user?.id ?? '')
      .single()

    const rawCpf = cpf.replace(/\D/g, '') || null

    const { error } = await supabase.from('patients').insert({
      name: name.trim(),
      phone: phone.trim(),
      cpf: rawCpf,
      clinic_id: member?.clinic_id,
    })

    if (error) {
      if (error.code === '23505') {
        toast.error('CPF já cadastrado')
      } else {
        toast.error('Erro ao cadastrar paciente')
      }
    } else {
      toast.success('Paciente cadastrado')
      onCreated()
      onOpenChange(false)
      reset()
    }
    setSaving(false)
  }

  return (
    <Sheet open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl max-h-[92dvh] overflow-y-auto px-5 pt-5 pb-8">

        <div className="flex items-start justify-between mb-5">
          <h2 className="text-xl font-bold">Novo paciente</h2>
          <SheetClose className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </SheetClose>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input
              className={cn(fieldCls, nameError && 'border-red-400 focus:border-red-400 focus:ring-red-400/20')}
              placeholder="Nome completo"
              value={name}
              onChange={e => { setName(e.target.value.slice(0, 100)); if (nameError) setNameError('') }}
              autoComplete="off"
            />
            {nameError && <p className="mt-1.5 text-xs text-red-500 font-medium">{nameError}</p>}
          </div>
          <div>
            <label className={labelCls}>Telefone *</label>
            <input
              className={cn(fieldCls, phoneError && 'border-red-400 focus:border-red-400 focus:ring-red-400/20')}
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={e => { setPhone(maskPhoneInput(e.target.value)); if (phoneError) setPhoneError('') }}
              inputMode="tel"
            />
            {phoneError && <p className="mt-1.5 text-xs text-red-500 font-medium">{phoneError}</p>}
          </div>
          <div>
            <label className={labelCls}>CPF (opcional)</label>
            <input
              className={fieldCls}
              placeholder="000.000.000-00"
              value={cpf}
              onChange={e => setCpf(maskCpfInput(e.target.value))}
              inputMode="numeric"
              maxLength={14}
            />
          </div>
          <Button type="submit" className="w-full h-12 text-base font-bold rounded-2xl" disabled={saving || name.trim().length < 3 || phone.replace(/\D/g, '').length < 10}>
            {saving ? 'Salvando…' : 'Cadastrar'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
