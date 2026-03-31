# Especificação do produto

## Problema

O consultório ainda usa papel para agenda e pacientes. O sistema precisa substituir esse fluxo com rapidez e simplicidade.

## Usuários

1. Recepcionista
2. Dentista

## Objetivo do MVP

1. Ver agenda do dia
2. Cadastrar paciente
3. Buscar paciente
4. Criar consulta
5. Registrar atendimento imediato
6. Marcar pagamento
7. Ver histórico
8. Exportar CSV
9. Compartilhar por WhatsApp
10. Gerar evento de calendário em ICS
11. Funcionar como PWA

## Regras principais

1. Login simples com usuários criados manualmente.
2. Recepcionista vê todos os médicos.
3. Dentista vê só a própria agenda.
4. Paciente tem nome, telefone, CPF e foto opcional.
5. Busca precisa aceitar nome e também telefone e CPF.
6. Consulta tem data, hora, duração, status, pagamento e método.
7. Status possíveis são apenas agendado, atendido e cancelado.
8. Pagamento pode ser pago ou não pago.
9. Método de pagamento pode ser Pix, dinheiro ou cartão.
10. Histórico por paciente deve mostrar consultas passadas com data e valor.
11. CPF deve ficar mascarado em listas e cartões.
12. A interface deve ser muito rápida e com poucos cliques.

## Fluxo ideal

1. Abrir app.
2. Ver agenda do dia.
3. Buscar paciente ou criar na hora.
4. Criar consulta ou walk in.
5. Marcar pagamento.
6. Compartilhar o texto ou o calendário, se necessário.
7. Consultar histórico do paciente.

## Fora do escopo da V1

1. ERP.
2. Automação avançada.
3. Integrações pagas.
4. Fluxos complexos de financeiro.
5. Múltiplas unidades com regras sofisticadas.