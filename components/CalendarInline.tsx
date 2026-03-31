'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const WEEK_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

export default function CalendarInline({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const sel      = new Date(value + 'T12:00:00')
  const today    = new Date()
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const [vy, setVy] = useState(sel.getFullYear())
  const [vm, setVm] = useState(sel.getMonth())

  useEffect(() => {
    const d = new Date(value + 'T12:00:00')
    setVy(d.getFullYear())
    setVm(d.getMonth())
  }, [value])

  const pad   = new Date(vy, vm, 1).getDay()
  const total = new Date(vy, vm + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(pad).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  function prev() { if (vm === 0) { setVy(y => y - 1); setVm(11) } else setVm(m => m - 1) }
  function next() { if (vm === 11) { setVy(y => y + 1); setVm(0)  } else setVm(m => m + 1) }
  function pick(d: number) { onChange(`${vy}-${String(vm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`) }

  return (
    <div className="pt-3">
      <div className="flex items-center justify-between px-1 mb-3">
        <button type="button" onClick={prev} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <p className="font-bold text-sm text-foreground">{MONTHS_PT[vm]} {vy}</p>
        <button type="button" onClick={next} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-muted transition-colors">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEK_PT.map((d, i) => (
          <p key={i} className={cn('text-center text-[11px] font-semibold py-1',
            i === 0 ? 'text-red-400' : 'text-muted-foreground')}>{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const isPast  = new Date(vy, vm, day) < todayMid
          const isSel   = sel.getFullYear() === vy && sel.getMonth() === vm && sel.getDate() === day
          const isToday = today.getFullYear() === vy && today.getMonth() === vm && today.getDate() === day
          const isSun   = (i % 7) === 0
          return (
            <div key={i} className="flex justify-center">
              <button type="button" onClick={() => pick(day)}
                className={cn(
                  'w-9 h-9 rounded-full text-sm font-medium transition-colors',
                  isSel   ? 'bg-primary text-white font-bold' :
                  isToday ? 'ring-2 ring-primary text-primary font-bold' :
                  isPast  ? 'text-muted-foreground/30 cursor-default' :
                  isSun   ? 'text-red-400 hover:bg-muted' :
                  'text-foreground hover:bg-muted'
                )}>
                {day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
