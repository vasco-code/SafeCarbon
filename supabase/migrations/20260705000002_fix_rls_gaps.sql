-- ============================================================================
-- Fix: lacunas de RLS deixadas pela migration inicial (20260705000001).
--
-- 1. audit_log e emission_factors foram criadas sem RLS habilitado. Como o
--    Supabase concede grants padrão de SELECT/INSERT/UPDATE/DELETE para
--    anon/authenticated em toda tabela nova, isso deixava as duas abertas a
--    leitura/escrita/deleção por qualquer usuário (autenticado ou não) via
--    REST. Mesma classe de risco da lição herdada do Conecta
--    (feedback_security_rls), na forma inversa: RLS ausente em vez de policy
--    USING(true) duplicada.
-- 2. organizations, org_members e project_roles ficaram com RLS habilitado
--    mas sem nenhuma policy — bloqueadas até para o próprio usuário, o que
--    impede o critério de aceite do Sprint 0 (usuário loga e vê seu projeto).
-- ============================================================================

alter table emission_factors enable row level security;

-- Biblioteca de referência versionada: leitura pública autenticada, sem
-- policy de escrita (INSERT/UPDATE/DELETE ficam bloqueados por padrão —
-- gestão via seed/migration ou futura function de admin com service_role).
create policy emission_factors_public_read
  on emission_factors for select
  using (true);

alter table audit_log enable row level security;

-- Append-only: sem nenhuma policy de escrita para client roles — os inserts
-- só ocorrem via fn_audit_trigger (security definer, executa como owner da
-- tabela, que faz bypass de RLS). Leitura restrita a admin da plataforma.
create policy audit_log_admin_read
  on audit_log for select
  using (is_platform_admin());

create policy organizations_member_read
  on organizations for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id = organizations.id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );

create policy org_members_self_read
  on org_members for select
  using (user_id = auth.uid() or is_platform_admin());

create policy project_roles_member_read
  on project_roles for select
  using (
    exists (
      select 1 from org_members om
      where om.org_id = project_roles.org_id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );
