export type UserRole = 'admin' | 'receptionist' | 'dentist'

export type AppointmentStatus = 'scheduled' | 'attended' | 'cancelled'
export type PaymentStatus = 'paid' | 'unpaid'
export type PaymentMethod = 'pix' | 'cash' | 'card'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  created_at: string
}

export interface Patient {
  id: string
  clinic_id: string
  name: string
  phone: string | null
  cpf: string | null
  photo_url: string | null
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  clinic_id: string
  patient_id: string
  doctor_id: string
  starts_at: string
  duration_minutes: number
  status: AppointmentStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  value: number | null
  notes: string | null
  created_at: string
  updated_at: string
  patient?: Patient
  doctor?: User
}

export interface ClinicMember {
  id: string
  clinic_id: string
  user_id: string
  role: UserRole
  created_at: string
  user?: User
}
