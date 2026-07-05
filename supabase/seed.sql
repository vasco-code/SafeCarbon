-- ============================================================================
-- Seed do Sprint 0 — organizações, projeto Premix e usuários de teste.
--
-- Pré-requisito: os 4 usuários abaixo já existem em auth.users (criados via
-- Auth Admin API, não por este script — sql puro não cria usuário de auth
-- corretamente, precisa passar pelo GoTrue para hash de senha/e-mail).
--   safetrace.admin@safecarbon.test   -> 7744c5d2-db44-4fe4-bfc5-8ee57e72d6c6
--   e2carbon.tecnico@safecarbon.test  -> eb28003a-1ebb-4a6c-89d3-f9f69b032bde
--   premix.gestor@safecarbon.test     -> 57ad3f0a-3f09-44ef-898b-229a4851dcaa
--   outsider.teste@safecarbon.test    -> f85ec8b3-973f-41ca-aeab-ab7219333692
--     (outsider deliberadamente SEM org_members — é o usuário do critério de
--     aceite "usuário de outra organização não vê nada")
--
-- IDs de organizações/projeto são fixos (prefixo 00000000-...) para o script
-- ser seguro de rodar mais de uma vez (ON CONFLICT DO NOTHING).
-- ============================================================================

insert into organizations (id, name, org_type, tax_id) values
  ('00000000-0000-0000-0000-000000000001', 'Safe Trace', 'platform_operator', null),
  ('00000000-0000-0000-0000-000000000002', 'E2Carbon', 'project_developer', null),
  ('00000000-0000-0000-0000-000000000003', 'Premix', 'proponent', null)
on conflict (id) do nothing;

insert into org_members (org_id, user_id, member_role) values
  ('00000000-0000-0000-0000-000000000001', '7744c5d2-db44-4fe4-bfc5-8ee57e72d6c6', 'owner'),
  ('00000000-0000-0000-0000-000000000002', 'eb28003a-1ebb-4a6c-89d3-f9f69b032bde', 'manager'),
  ('00000000-0000-0000-0000-000000000003', '57ad3f0a-3f09-44ef-898b-229a4851dcaa', 'manager')
on conflict (org_id, user_id) do nothing;

insert into carbon_projects (id, name, proponent_org_id, developer_org_id, status) values
  (
    '00000000-0000-0000-0000-0000000000a1',
    'Premix - Fator P',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'design'
  )
on conflict (id) do nothing;

insert into project_roles (project_id, org_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000003', 'proponent'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000002', 'developer')
on conflict (project_id, org_id, role) do nothing;
