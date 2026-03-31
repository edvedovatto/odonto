-- ============================================================
-- Odonto MVP — Migration inicial
-- ============================================================

-- Extensão para UUID
create extension if not exists "pgcrypto";

-- ============================================================
-- clinics
-- ============================================================
create table if not exists clinics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- users (espelha auth.users com dados extras)
-- ============================================================
create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  role        text not null check (role in ('admin', 'receptionist', 'dentist')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- clinic_members
-- ============================================================
create table if not exists clinic_members (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        text not null check (role in ('admin', 'receptionist', 'dentist')),
  created_at  timestamptz not null default now(),
  unique (clinic_id, user_id)
);

-- ============================================================
-- patients
-- ============================================================
create table if not exists patients (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  name        text not null,
  phone       text,
  cpf         text,
  photo_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (clinic_id, cpf)
);

create index if not exists idx_patients_name      on patients (name);
create index if not exists idx_patients_phone     on patients (phone);
create index if not exists idx_patients_cpf       on patients (cpf);
create index if not exists idx_patients_clinic_id on patients (clinic_id);

-- ============================================================
-- appointments
-- ============================================================
create table if not exists appointments (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  patient_id       uuid not null references patients(id) on delete cascade,
  doctor_id        uuid not null references users(id),
  starts_at        timestamptz not null,
  duration_minutes integer not null default 30,
  status           text not null default 'scheduled'
                     check (status in ('scheduled', 'attended', 'cancelled')),
  payment_status   text not null default 'unpaid'
                     check (payment_status in ('paid', 'unpaid')),
  payment_method   text check (payment_method in ('pix', 'cash', 'card')),
  value            numeric(10,2),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_appointments_starts_at   on appointments (starts_at);
create index if not exists idx_appointments_doctor_id   on appointments (doctor_id);
create index if not exists idx_appointments_patient_id  on appointments (patient_id);
create index if not exists idx_appointments_clinic_id   on appointments (clinic_id);

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_patients_updated_at
  before update on patients
  for each row execute function set_updated_at();

create trigger trg_appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();
