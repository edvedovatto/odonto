# Modelo de dados

## Regras gerais

1. Todas as tabelas principais precisam ter id, created_at e updated_at.
2. CPF deve ser único quando existir.
3. CPF pode ser nulo.
4. Indexar name, phone, cpf, starts_at, doctor_id e patient_id.
5. Preparar o esquema para múltiplos médicos.

## Tabelas

### users

1. id
2. name
3. email
4. role
5. created_at

### clinic_members

1. id
2. clinic_id
3. user_id
4. role
5. created_at

### patients

1. id
2. clinic_id
3. name
4. phone
5. cpf
6. photo_url
7. created_at
8. updated_at

### appointments

1. id
2. clinic_id
3. patient_id
4. doctor_id
5. starts_at
6. duration_minutes
7. status
8. payment_status
9. payment_method
10. value
11. notes
12. created_at
13. updated_at

### appointment_events opcional

1. id
2. appointment_id
3. event_type
4. payload
5. created_at

## Regras de segurança

1. Usar RLS em todas as tabelas expostas.
2. Nunca expor service role no frontend.
3. Separar leitura e escrita por papel e por clínica.