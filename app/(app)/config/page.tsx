'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { exportCSV } from '@/lib/export'
import type { Appointment } from '@/lib/types'
import { toast } from 'sonner'
import { Download, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

type StatusFilter = 'all' | 'attended' | 'paid'

const currentYear = new Date().getFullYear()
const FROM = `${currentYear}-01-01`
const TO = `${currentYear}-12-31`

export default function ConfigPage() {
  const supabase = createClient()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [exporting, setExporting] = useState(false)
  const [preview, setPreview] = useState<{ total: number } | null>(null)

  const loadPreview = useCallback(async () => {
    let query = supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .gte('starts_at', `${FROM}T00:00:00`)
      .lte('starts_at', `${TO}T23:59:59`)
      .neq('status', 'cancelled')

    if (statusFilter === 'attended') {
      query = query.eq('status', 'attended')
    } else if (statusFilter === 'paid') {
      query = query.eq('payment_status', 'paid')
    }

    const { count } = await query
    setPreview({ total: count ?? 0 })
  }, [supabase, statusFilter])

  useEffect(() => { loadPreview() }, [loadPreview])

  async function handleExport() {
    setExporting(true)
    let query = supabase
      .from('appointments')
      .select('*, patient:patients(id, name, phone, cpf, photo_url), doctor:users(id, name, email, role)')
      .gte('starts_at', `${FROM}T00:00:00`)
      .lte('starts_at', `${TO}T23:59:59`)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true })

    if (statusFilter === 'attended') {
      query = query.eq('status', 'attended')
    } else if (statusFilter === 'paid') {
      query = query.eq('payment_status', 'paid')
    }

    const { data, error } = await query
    if (error) {
      toast.error('Erro ao buscar dados')
      setExporting(false)
      return
    }
    if (!data || data.length === 0) {
      toast.error('Nenhum agendamento encontrado')
      setExporting(false)
      return
    }
    exportCSV(data as Appointment[])
    toast.success(`${data.length} agendamento${data.length !== 1 ? 's' : ''} exportado${data.length !== 1 ? 's' : ''}`)
    setExporting(false)
  }

  const filterOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'attended', label: 'Finalizados' },
    { value: 'paid', label: 'Pagos' },
  ]

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-5 pt-14 pb-5 bg-primary text-white">
        <h1 className="text-[2rem] font-bold tracking-tight leading-tight">Configurações</h1>
      </div>

      <div className="px-5 py-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold mb-1">Exportar agendamentos</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Período: 01/01/{currentYear} a 31/12/{currentYear}
          </p>

          {/* Filtro de status */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Filtrar por</p>
            <div className="flex gap-2">
              {filterOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    'flex-1 h-11 rounded-xl text-sm font-semibold border transition-all',
                    statusFilter === opt.value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-background text-muted-foreground border-border'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview + botão */}
          <div className="mt-5">
            {preview && (
              <p className="text-sm text-muted-foreground mb-3">
                {preview.total === 0
                  ? 'Nenhum agendamento no período'
                  : `${preview.total} agendamento${preview.total !== 1 ? 's' : ''} encontrado${preview.total !== 1 ? 's' : ''}`
                }
              </p>
            )}
            <Button
              onClick={handleExport}
              disabled={exporting || (preview?.total === 0)}
              className="w-full h-12 rounded-xl font-bold text-base gap-2"
            >
              <Download className="w-5 h-5" />
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </Button>
          </div>
        </div>

        {/* Logout */}
        <div className="pt-4 border-t border-border">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="w-full h-12 rounded-xl border border-red-200 text-red-500 text-sm font-semibold flex items-center justify-center gap-2 active:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
