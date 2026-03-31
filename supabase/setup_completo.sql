-- ============================================================
-- ODONTO MVP — Setup completo
-- Cole tudo no SQL Editor do Supabase e execute
-- ============================================================

create extension if not exists "pgcrypto";

-- clinics
create table if not exists clinics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- users
create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  role        text not null check (role in ('admin', 'receptionist', 'dentist')),
  created_at  timestamptz not null default now()
);

-- clinic_members
create table if not exists clinic_members (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  role        text not null check (role in ('admin', 'receptionist', 'dentist')),
  created_at  timestamptz not null default now(),
  unique (clinic_id, user_id)
);

-- patients
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

-- appointments
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

-- Trigger updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_patients_updated_at on patients;
create trigger trg_patients_updated_at
  before update on patients
  for each row execute function set_updated_at();

drop trigger if exists trg_appointments_updated_at on appointments;
create trigger trg_appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();

-- ============================================================
-- RLS
-- ============================================================

create or replace function my_clinic_id()
returns uuid language sql security definer stable as $$
  select clinic_id from clinic_members where user_id = auth.uid() limit 1;
$$;

create or replace function my_clinic_role()
returns text language sql security definer stable as $$
  select role from clinic_members where user_id = auth.uid() limit 1;
$$;

alter table clinics enable row level security;
drop policy if exists "clinics: membros leem" on clinics;
create policy "clinics: membros leem" on clinics
  for select using (id = my_clinic_id());

alter table users enable row level security;
drop policy if exists "users: lê membros da mesma clínica" on users;
create policy "users: lê membros da mesma clínica" on users
  for select using (
    id in (select user_id from clinic_members where clinic_id = my_clinic_id())
  );

alter table clinic_members enable row level security;
drop policy if exists "clinic_members: lê própria clínica" on clinic_members;
create policy "clinic_members: lê própria clínica" on clinic_members
  for select using (clinic_id = my_clinic_id());

alter table patients enable row level security;
drop policy if exists "patients: lê da própria clínica" on patients;
drop policy if exists "patients: insere na própria clínica" on patients;
drop policy if exists "patients: atualiza na própria clínica" on patients;
create policy "patients: lê da própria clínica" on patients
  for select using (clinic_id = my_clinic_id());
create policy "patients: insere na própria clínica" on patients
  for insert with check (clinic_id = my_clinic_id());
create policy "patients: atualiza na própria clínica" on patients
  for update using (clinic_id = my_clinic_id());

alter table appointments enable row level security;
drop policy if exists "appointments: leitura" on appointments;
drop policy if exists "appointments: insere" on appointments;
drop policy if exists "appointments: atualiza" on appointments;
create policy "appointments: leitura" on appointments
  for select using (
    clinic_id = my_clinic_id()
    and (my_clinic_role() in ('admin', 'receptionist') or doctor_id = auth.uid())
  );
create policy "appointments: insere" on appointments
  for insert with check (clinic_id = my_clinic_id());
create policy "appointments: atualiza" on appointments
  for update using (
    clinic_id = my_clinic_id()
    and (my_clinic_role() in ('admin', 'receptionist') or doctor_id = auth.uid())
  );

-- ============================================================
-- SEED — Clínica Vedo
-- ============================================================

-- Clínica
insert into clinics (id, name) values
  ('185fd179-fcca-453d-bd3d-fc5e6437e960', 'Vedo')
on conflict do nothing;

-- Usuários
insert into users (id, name, email, role) values
  ('7c4aba30-047d-47f7-ad0d-f35f1766f5dc', 'Eduardo',    'eduardo@vedovatto.com', 'admin'),
  ('a5dada33-1cc8-4a69-9063-31261f6cbcad', 'Doutor 1',   'doutor1@vedo.com',      'dentist'),
  ('8c0dc4fb-0ffa-4250-9b89-6ce1930e4b90', 'Doutor 2',   'doutor2@vedo.com',      'dentist'),
  ('76e700e0-8b86-4e0c-bcfb-5f9087dbf432', 'Doutor 3',   'doutor3@vedo.com',      'dentist'),
  ('c90682fa-ef67-4e87-9f6e-eb89838c54cf', 'Recepção',   'recepcao@vedo.com',     'receptionist')
on conflict do nothing;

-- Membros da clínica
insert into clinic_members (clinic_id, user_id, role) values
  ('185fd179-fcca-453d-bd3d-fc5e6437e960', '7c4aba30-047d-47f7-ad0d-f35f1766f5dc', 'admin'),
  ('185fd179-fcca-453d-bd3d-fc5e6437e960', 'a5dada33-1cc8-4a69-9063-31261f6cbcad', 'dentist'),
  ('185fd179-fcca-453d-bd3d-fc5e6437e960', '8c0dc4fb-0ffa-4250-9b89-6ce1930e4b90', 'dentist'),
  ('185fd179-fcca-453d-bd3d-fc5e6437e960', '76e700e0-8b86-4e0c-bcfb-5f9087dbf432', 'dentist'),
  ('185fd179-fcca-453d-bd3d-fc5e6437e960', 'c90682fa-ef67-4e87-9f6e-eb89838c54cf', 'receptionist')
on conflict do nothing;
