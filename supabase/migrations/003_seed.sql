-- ============================================================
-- Seed — dados de exemplo
-- Execute APÓS criar os usuários via Supabase Auth dashboard
-- Substitua os UUIDs pelos IDs reais gerados no Supabase Auth
-- ============================================================

-- 1. Criar clínica
insert into clinics (id, name) values
  ('185fd179-fcca-453d-bd3d-fc5e6437e960', 'Vedo')
on conflict do nothing;

-- 2. Após criar usuários no Supabase Auth (Authentication > Users),
--    insira os dados de perfil aqui substituindo os UUIDs:

-- insert into users (id, name, email, role) values
--   ('<UUID-DO-DENTISTA>',      'Dr. João Silva',   'dentista@odonto.com',      'dentist'),
--   ('<UUID-DA-RECEPCIONISTA>', 'Ana Recepcionista', 'recepcao@odonto.com', 'receptionist')
-- on conflict do nothing;

-- insert into clinic_members (clinic_id, user_id, role) values
--   ('00000000-0000-0000-0000-000000000001', '<UUID-DO-DENTISTA>',      'dentist'),
--   ('00000000-0000-0000-0000-000000000001', '<UUID-DA-RECEPCIONISTA>', 'receptionist')
-- on conflict do nothing;
