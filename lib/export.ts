import type { Appointment } from './types'
import { formatTime, formatDate, formatCurrency } from './utils'

const statusLabel: Record<string, string> = {
  scheduled: 'Agendado',
  attended: 'Atendido',
  cancelled: 'Cancelado',
}

const methodLabel: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão',
}

// --- WhatsApp ---
export function shareWhatsApp(apt: Appointment) {
  const lines = [
    `Olá! Sua consulta na Clínica Vedo está confirmada.`,
    ``,
    `*Médico:* ${apt.doctor?.name ?? '—'}`,
    `*Data:* ${formatDate(apt.starts_at)}`,
    `*Horário:* ${formatTime(apt.starts_at)}`,
    ``,
    `Até lá!`,
  ]

  const text = encodeURIComponent(lines.join('\n'))
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

// --- ICS ---
function toICSDate(isoString: string): string {
  return isoString.replace(/[-:]/g, '').split('.')[0] + 'Z'
}

export function generateICS(apt: Appointment) {
  const start = toICSDate(apt.starts_at)
  const endDate = new Date(new Date(apt.starts_at).getTime() + apt.duration_minutes * 60000)
  const end = toICSDate(endDate.toISOString())
  const summary = `Consulta — ${apt.patient?.name ?? 'Paciente'}`
  const description = `Médico: ${apt.doctor?.name ?? '—'}\\nStatus: ${statusLabel[apt.status] ?? apt.status}`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Odonto//PT',
    'BEGIN:VEVENT',
    `UID:${apt.id}@odonto`,
    `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `consulta-${apt.id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// --- CSV ---
export function exportCSV(appointments: Appointment[]) {
  const headers = ['Data', 'Hora', 'Paciente', 'CPF', 'Médico', 'Status', 'Pagamento', 'Método', 'Valor']
  const rows = appointments.map(apt => [
    formatDate(apt.starts_at),
    formatTime(apt.starts_at),
    apt.patient?.name ?? '',
    apt.patient?.cpf ?? '',
    apt.doctor?.name ?? '',
    statusLabel[apt.status] ?? apt.status,
    apt.payment_status === 'paid' ? 'Pago' : 'Não pago',
    apt.payment_method ? (methodLabel[apt.payment_method] ?? apt.payment_method) : '',
    apt.value != null ? String(apt.value) : '',
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `agenda-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
