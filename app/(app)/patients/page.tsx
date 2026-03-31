'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { maskCpf, formatPhone, sanitizeSearch } from '@/lib/utils'
import type { Patient } from '@/lib/types'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import NewPatientSheet from '@/components/NewPatientSheet'

export default function PatientsPage() {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadPatients(term: string) {
    setLoading(true)
    let query = supabase.from('patients').select('*').order('name').limit(30)
    if (term.trim()) {
      const safe = sanitizeSearch(term)
      query = query.or(`name.ilike.%${safe}%,phone.ilike.%${safe}%,cpf.ilike.%${safe}%`)
    }
    const { data } = await query
    setPatients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadPatients('') }, [])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => loadPatients(search), 300)
  }, [search])

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="px-5 pt-14 pb-5 bg-primary text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[2rem] font-bold tracking-tight leading-tight">Pacientes</h1>
            <p className="text-white/55 text-sm mt-1">
              {loading ? '…' : patients.length === 0 ? 'Nenhum cadastrado' : `${patients.length} paciente${patients.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            onClick={() => setNewOpen(true)}
            className="bg-white text-primary hover:bg-white/90 font-bold rounded-2xl h-11 px-5 shrink-0 shadow-sm mt-1"
          >
            + Novo
          </Button>
        </div>

        {/* Busca */}
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por nome, telefone ou CPF…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-10 rounded-xl border-0 pl-9 pr-3 text-sm bg-white/15 text-white placeholder:text-white/40 outline-none"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-4 space-y-2.5">
        {loading ? (
          <>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-[72px] rounded-2xl bg-muted animate-pulse" />
            ))}
          </>
        ) : patients.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="font-bold text-foreground mb-1">Nenhum paciente</p>
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhum resultado para essa busca' : 'Cadastre o primeiro paciente'}
            </p>
          </div>
        ) : (
          patients.map(p => (
            <Link
              key={p.id}
              href={`/patients/${p.id}`}
              className="flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="text-primary font-bold text-sm">{p.name[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px] truncate">{p.name}</p>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {formatPhone(p.phone)}{p.cpf ? ` · ${maskCpf(p.cpf)}` : ''}
                </p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ))
        )}
      </div>

      <NewPatientSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => loadPatients(search)}
      />
    </div>
  )
}
