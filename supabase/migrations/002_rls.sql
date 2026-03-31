-- ============================================================
-- RLS — Row Level Security
-- ============================================================

-- Helper: retorna clinic_id do usuário autenticado
create or replace function my_clinic_id()
returns uuid language sql security definer stable as $$
  select clinic_id from clinic_members where user_id = auth.uid() limit 1;
$$;

-- Helper: retorna role do usuário na clínica
create or replace function my_clinic_role()
returns text language sql security definer stable as $$
  select role from clinic_members where user_id = auth.uid() limit 1;
$$;

-- ============================================================
-- clinics
-- ============================================================
alter table clinics enable row level security;

create policy "clinics: membros leem" on clinics
  for select using (
    id = my_clinic_id()
  );

-- ============================================================
-- users
-- ============================================================
alter table users enable row level security;

create policy "users: lê membros da mesma clínica" on users
  for select using (
    id in (
      select user_id from clinic_members where clinic_id = my_clinic_id()
    )
  );

-- ============================================================
-- clinic_members
-- ============================================================
alter table clinic_members enable row level security;

create policy "clinic_members: lê própria clínica" on clinic_members
  for select using (clinic_id = my_clinic_id());

-- ============================================================
-- patients
-- ============================================================
alter table patients enable row level security;

create policy "patients: lê da própria clínica" on patients
  for select using (clinic_id = my_clinic_id());

create policy "patients: insere na própria clínica" on patients
  for insert with check (clinic_id = my_clinic_id());

create policy "patients: atualiza na própria clínica" on patients
  for update using (clinic_id = my_clinic_id());

-- ============================================================
-- appointments
-- ============================================================
alter table appointments enable row level security;

-- Recepcionista e admin veem todos da clínica
-- Dentista vê só as suas
create policy "appointments: leitura" on appointments
  for select using (
    clinic_id = my_clinic_id()
    and (
      my_clinic_role() in ('admin', 'receptionist')
      or doctor_id = auth.uid()
    )
  );

create policy "appointments: insere" on appointments
  for insert with check (clinic_id = my_clinic_id());

create policy "appointments: atualiza" on appointments
  for update using (
    clinic_id = my_clinic_id()
    and (
      my_clinic_role() in ('admin', 'receptionist')
      or doctor_id = auth.uid()
    )
  );
