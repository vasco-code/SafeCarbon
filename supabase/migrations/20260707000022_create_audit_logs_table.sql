-- Sistema de Auditoria Completo
-- Rastreia todas as ações dos usuários (CREATE, UPDATE, DELETE, soft delete)

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Identificação da ação
  action text not null check (action in ('CREATE', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'RESTORE', 'PUBLISH', 'DEPRECATE')),
  entity_type text not null, -- 'methodology', 'methodology_version', 'project', etc
  entity_id uuid not null,

  -- Quem fez
  performed_by uuid not null references auth.users(id),
  organization_id uuid references organizations(id),

  -- O que mudou
  changes jsonb, -- antes/depois para UPDATE, dados completos para CREATE

  -- Contexto
  ip_address text,
  user_agent text,

  -- Timestamp
  created_at timestamptz not null default now(),

  -- Para correlacionar ações relacionadas
  related_entity_id uuid,
  related_entity_type text
);

-- Índices para busca eficiente
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_user on audit_logs(performed_by, created_at);
create index idx_audit_logs_organization on audit_logs(organization_id, created_at);
create index idx_audit_logs_timestamp on audit_logs(created_at desc);

-- RLS: Cada usuário vê logs de organizações às quais pertence
alter table audit_logs enable row level security;

create policy audit_logs_own_org_read
  on audit_logs for select
  to authenticated
  using (
    organization_id is null
    or exists (
      select 1 from org_members om
      where om.org_id = audit_logs.organization_id
        and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );

-- Platform admin pode ver tudo
create policy audit_logs_admin_read
  on audit_logs for select
  to authenticated
  using (is_platform_admin());
