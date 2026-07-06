-- Funções para auditoria e replicação de versões de metodologias

-- Função para registrar auditoria
create or replace function log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_changes jsonb default null,
  p_related_entity_id uuid default null,
  p_related_entity_type text default null
)
returns uuid as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_log_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return null;
  end if;

  -- Tentar pegar organization_id do contexto se existir
  -- (pode ser passado via jwt.claims->>'org_id' em um futuro)
  v_org_id := null;

  insert into audit_logs (action, entity_type, entity_id, performed_by, organization_id, changes, related_entity_id, related_entity_type)
  values (p_action, p_entity_type, p_entity_id, v_user_id, v_org_id, p_changes, p_related_entity_id, p_related_entity_type)
  returning id into v_log_id;

  return v_log_id;
end;
$$ language plpgsql security definer;

-- Função para replicar uma versão de metodologia
create or replace function replicate_methodology_version(
  p_version_id uuid,
  p_new_label text
)
returns uuid as $$
declare
  v_user_id uuid;
  v_methodology_id uuid;
  v_new_version_id uuid;
  v_org_id uuid;
  v_new_params record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  -- Validar que versão existe e usuário tem permissão
  select m.id, m.owner_org_id
  into v_methodology_id, v_org_id
  from methodology_versions mv
  join methodologies m on m.id = mv.methodology_id
  join org_members om on om.org_id = m.owner_org_id
  where mv.id = p_version_id
    and mv.deleted_at is null
    and m.deleted_at is null
    and om.user_id = v_user_id;

  if v_methodology_id is null then
    raise exception 'Versão não encontrada ou sem permissão';
  end if;

  -- Criar nova versão
  insert into methodology_versions (
    methodology_id,
    version_label,
    status,
    sections,
    replicated_from_version_id
  )
  select
    v_methodology_id,
    p_new_label,
    'draft',
    sections,
    p_version_id
  from methodology_versions
  where id = p_version_id
  returning id into v_new_version_id;

  -- Copiar parâmetros
  insert into methodology_parameters (
    methodology_version_id,
    param_key,
    value,
    unit,
    source_citation,
    valid_from,
    valid_to
  )
  select
    v_new_version_id,
    param_key,
    value,
    unit,
    source_citation,
    valid_from,
    valid_to
  from methodology_parameters
  where methodology_version_id = p_version_id
    and deleted_at is null;

  -- Registrar auditoria
  perform log_audit(
    'CREATE',
    'methodology_version',
    v_new_version_id,
    jsonb_build_object('replicated_from', p_version_id, 'new_label', p_new_label),
    p_version_id,
    'methodology_version'
  );

  return v_new_version_id;
end;
$$ language plpgsql security definer;

-- Função para soft delete de metodologia
create or replace function soft_delete_methodology(
  p_methodology_id uuid
)
returns void as $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  -- Verificar permissão (owner ou manager da org)
  update methodologies m
  set deleted_at = now(), deleted_by = v_user_id
  where m.id = p_methodology_id
    and exists (
      select 1 from org_members om
      where om.org_id = m.owner_org_id
        and om.user_id = v_user_id
        and om.member_role in ('owner', 'manager')
    );

  if found then
    perform log_audit('SOFT_DELETE', 'methodology', p_methodology_id);
  else
    raise exception 'Metodologia não encontrada ou sem permissão';
  end if;
end;
$$ language plpgsql security definer;

-- Função para restaurar metodologia
create or replace function restore_methodology(
  p_methodology_id uuid
)
returns void as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  update methodologies m
  set deleted_at = null, deleted_by = null
  where m.id = p_methodology_id
    and exists (
      select 1 from org_members om
      where om.org_id = m.owner_org_id
        and om.user_id = v_user_id
        and om.member_role in ('owner', 'manager')
    );

  if found then
    perform log_audit('RESTORE', 'methodology', p_methodology_id);
  else
    raise exception 'Metodologia não encontrada ou sem permissão';
  end if;
end;
$$ language plpgsql security definer;
