'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { maskCpf, formatPhone, formatDate, maskPhoneInput, maskCpfInput } from '@/lib/utils'
import type { Appointment, Patient, User } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import NewAppointmentSheet from '@/components/NewAppointmentSheet'
import AppointmentCard from '@/components/AppointmentCard'

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [newOpen, setNewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCpf, setEditCpf] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: member } = await supabase
          .from('clinic_members')
          .select('role, user:users(id, name, email, role)')
          .eq('user_id', user.id)
          .single()
        if (member?.user) {
          const u = Array.isArray(member.user) ? member.user[0] : member.user
          setCurrentUser({ ...u, role: member.role } as User)
        }
      }

      const { data: p } = await supabase.from('patients').select('*').eq('id', id).single()
      setPatient(p)

      const { data: apts } = await supabase
        .from('appointments')
        .select('*, patient:patients(id, name), doctor:users(id, name, email, role)')
        .eq('patient_id', id)
        .order('starts_at', { ascending: false })
      setAppointments((apts as Appointment[]) ?? [])

      const { data: docs } = await supabase
        .from('clinic_members')
        .select('user:users(id, name, email, role)')
        .eq('role', 'dentist')
      if (docs) setDoctors(docs.map((d: { user: User | User[] }) => (Array.isArray(d.user) ? d.user[0] : d.user) as User).filter(Boolean))

      setLoading(false)
    }
    load()
  }, [id, supabase])

  if (loading) return (
    <div className="max-w-lg mx-auto">
      <div className="px-5 pt-14 pb-5 bg-primary">
        <div className="h-8 w-48 rounded-xl bg-white/20 animate-pulse mb-2" />
        <div className="h-4 w-32 rounded-xl bg-white/20 animate-pulse" />
      </div>
      <div className="px-4 py-4 space-y-2.5">
        {[1, 2, 3].map(i => <div key={i} className="h-[72px] rounded-2xl bg-muted animate-pulse" />)}
      </div>
    </div>
  )

  if (!patient) return (
    <div className="text-center py-16 px-4">
      <p className="text-muted-foreground">Paciente não encontrado</p>
      <Button className="mt-4" onClick={() => router.back()}>Voltar</Button>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="px-5 pt-14 pb-5 bg-primary text-white">
        <div className="flex items-start justify-between mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-white/80 bg-white/15 rounded-full px-3 py-1.5 mt-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Pacientes
          </button>
          <Button
            onClick={() => setNewOpen(true)}
            className="bg-white text-primary hover:bg-white/90 font-bold rounded-2xl h-11 px-4 shrink-0 shadow-sm mt-1"
          >
            + Consulta
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            {patient.photo_url ? (
              <img src={patient.photo_url} alt={patient.name} className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <span className="text-white font-bold text-xl">{patient.name[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-[1.4rem] font-bold leading-tight truncate">{patient.name}</h1>
            <a
              href={`https://wa.me/55${patient.phone?.replace(/\D/g, '') ?? ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 text-sm mt-0.5 active:text-white/90"
            >
              {patient.phone ? formatPhone(patient.phone) : 'Sem telefone'}
            </a>
          </div>
        </div>

        {/* Detalhes */}
        <div className="flex items-center gap-4 mt-4 text-sm text-white/55">
          <div className="flex gap-4 flex-1">
            {patient.cpf && <span>CPF: {maskCpf(patient.cpf)}</span>}
            <span>Desde {formatDate(patient.created_at)}</span>
          </div>
          <button
            onClick={() => {
              setEditName(patient.name)
              setEditPhone(patient.phone ? maskPhoneInput(patient.phone) : '')
              setEditCpf(patient.cpf ? maskCpfInput(patient.cpf) : '')
              setEditOpen(true)
            }}
            className="text-white/70 active:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div className="px-4 py-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
          Histórico · {appointments.length} consulta{appointments.length !== 1 ? 's' : ''}
        </p>

        {appointments.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <p className="font-bold text-foreground mb-1">Nenhuma consulta</p>
            <p className="text-sm text-muted-foreground">Ainda não há histórico para este paciente</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {appointments.map(apt => (
              <AppointmentCard
                key={apt.id}
                appointment={apt}
                doctors={doctors}
                currentUser={currentUser}
                showDate
                onUpdate={updated => setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))}
              />
            ))}
          </div>
        )}
      </div>

      <NewAppointmentSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultDate={new Date().toISOString().slice(0, 10)}
        doctors={doctors}
        currentUser={currentUser}
        onCreated={async () => {
          const { data } = await supabase
            .from('appointments')
            .select('*, patient:patients(id, name), doctor:users(id, name, email, role)')
            .eq('patient_id', id)
            .order('starts_at', { ascending: false })
          setAppointments((data as Appointment[]) ?? [])
        }}
      />

      {/* Sheet de editar paciente */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl max-h-[92dvh] overflow-y-auto px-5 pt-5 pb-8">
          <div className="flex items-start justify-between mb-5">
            <h2 className="text-xl font-bold">Editar paciente</h2>
            <SheetClose className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </SheetClose>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (editName.trim().length < 3) { toast.error('Nome deve ter pelo menos 3 caracteres'); return }
              const rawPhone = editPhone.replace(/\D/g, '')
              if (rawPhone.length < 10) { toast.error('Telefone é obrigatório'); return }
              setEditSaving(true)
              const rawCpf = editCpf.replace(/\D/g, '') || null
              const { error } = await supabase.from('patients').update({
                name: editName.trim().slice(0, 100),
                phone: rawPhone,
                cpf: rawCpf,
              }).eq('id', id)
              if (error) {
                if (error.code === '23505') toast.error('CPF já cadastrado')
                else toast.error('Erro ao salvar')
              } else {
                setPatient(prev => prev ? { ...prev, name: editName.trim().slice(0, 100), phone: rawPhone, cpf: rawCpf } : prev)
                toast.success('Paciente atualizado')
                setEditOpen(false)
              }
              setEditSaving(false)
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Nome *</label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value.slice(0, 100))}
                placeholder="Nome completo"
                className="h-12 rounded-xl text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Telefone *</label>
              <Input
                value={editPhone}
                onChange={e => setEditPhone(maskPhoneInput(e.target.value))}
                placeholder="(00) 00000-0000"
                type="tel"
                inputMode="tel"
                className="h-12 rounded-xl text-sm font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">CPF (opcional)</label>
              <Input
                value={editCpf}
                onChange={e => setEditCpf(maskCpfInput(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
                maxLength={14}
                className="h-12 rounded-xl text-sm font-medium"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-bold text-base"
              disabled={editSaving || editName.trim().length < 3 || editPhone.replace(/\D/g, '').length < 10}
            >
              {editSaving ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
