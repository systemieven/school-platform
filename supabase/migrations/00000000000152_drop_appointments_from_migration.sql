-- Migration 152: Central de Migracao — remover 'appointments' do escopo do OP-1.
--
-- Agendamentos nao sao um modulo vital de migracao inicial em ERPs escolares
-- (nem todo sistema anterior tem esse dado; quando tem, raramente e relevante
-- apos o corte). Para nao poluir a Central de Migracao com um card vazio
-- permanentemente "Em breve", removemos a row do catalogo.
--
-- A tabela `appointments` e o modulo `attendance` seguem ativos normalmente;
-- o que removemos aqui e apenas a entrada no painel /admin/migracao.

DELETE FROM module_imports WHERE module_key = 'appointments';
