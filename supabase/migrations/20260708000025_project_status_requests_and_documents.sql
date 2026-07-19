-- ============================================================================
-- Reestruturação de acesso por perfil (Premix/VVB/E2Carbon) — parte 1/3,
-- schema aditivo. Não toca em nenhuma policy existente — pode ir para
-- produção a qualquer momento, sem afetar o que já está no ar.
--
-- 1) project_status_requests: Premix (proponent) só pode SOLICITAR
--    inativação do projeto, nunca executar sozinha — developer/admin/
--    platform_admin aprovam ou rejeitam via resolve_project_status_request().
-- 2) project_documents + bucket "project-documents": repositório central
--    (aba Documentos) e área de upload da VVB (aba Verificação, doc_type
--    'auditoria_aprovacao'/'plano_melhorias'). Primeira vez que o projeto
--    usa Supabase Storage de fato — antes disso todo campo *_url era só
--    texto (nunca houve upload real de blob).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- project_status_requests
-- ----------------------------------------------------------------------------

create table project_status_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  requested_by uuid not null references auth.users (id),
  requested_by_org_id uuid not null references organizations (id),
  requested_status project_status not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index idx_project_status_requests_project on project_status_requests (project_id, status);

alter table project_status_requests enable row level security;

-- Insert: só quem tem papel proponent no projeto, e só na própria organização.
create policy project_status_requests_insert
  on project_status_requests for insert
  to authenticated
  with check (
    has_project_role(project_id, array['proponent']::project_role[])
    and exists (
      select 1 from org_members om
      where om.org_id = requested_by_org_id and om.user_id = auth.uid()
    )
  );

-- Select: o proponent vê os pedidos da própria org; developer/admin/platform_admin veem todos do projeto.
create policy project_status_requests_select
  on project_status_requests for select
  to authenticated
  using (
    exists (
      select 1 from org_members om
      where om.org_id = project_status_requests.requested_by_org_id and om.user_id = auth.uid()
    )
    or has_project_role(project_id, array['developer', 'admin']::project_role[])
    or is_platform_admin()
  );

-- Sem policy de UPDATE para o client — aprovar/rejeitar só via
-- resolve_project_status_request() (security definer, checa permissão e
-- revalida a transição de status antes de gravar).

-- ----------------------------------------------------------------------------
-- resolve_project_status_request — segue o padrão de soft_delete_methodology/
-- replicate_methodology_version (20260707000024): checagem de permissão
-- fundida no WHERE do update (não vaza "existe mas sem permissão" vs "não
-- existe"), e log_audit no final.
-- ----------------------------------------------------------------------------

create or replace function resolve_project_status_request(
  p_request_id uuid,
  p_approve boolean,
  p_review_note text default null
)
returns void as $$
declare
  v_user_id uuid;
  v_project_id uuid;
  v_requested_status project_status;
  v_current_status project_status;
  v_new_status text;
  v_allowed boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  v_new_status := case when p_approve then 'approved' else 'rejected' end;

  update project_status_requests r
  set status = v_new_status,
      reviewed_by = v_user_id,
      reviewed_at = now(),
      review_note = p_review_note
  where r.id = p_request_id
    and r.status = 'pending'
    and (has_project_role(r.project_id, array['developer', 'admin']::project_role[]) or is_platform_admin())
  returning r.project_id, r.requested_status into v_project_id, v_requested_status;

  if not found then
    raise exception 'Solicitação não encontrada ou sem permissão';
  end if;

  if p_approve then
    select status into v_current_status from carbon_projects where id = v_project_id;

    -- Revalida a mesma máquina de estados hoje só em JS no StatusCard —
    -- a função precisa reforçar, não confiar só no client.
    v_allowed := case v_current_status
      when 'design' then v_requested_status in ('validation', 'suspended')
      when 'validation' then v_requested_status in ('active', 'design', 'suspended')
      when 'active' then v_requested_status in ('suspended', 'closed')
      when 'suspended' then v_requested_status in ('active', 'closed')
      else false
    end;

    if not v_allowed then
      raise exception 'Transição de status inválida: % -> %', v_current_status, v_requested_status;
    end if;

    update carbon_projects set status = v_requested_status where id = v_project_id;
  end if;

  perform log_audit(
    'UPDATE',
    'project_status_request',
    p_request_id,
    jsonb_build_object('outcome', v_new_status, 'project_id', v_project_id, 'requested_status', v_requested_status, 'review_note', p_review_note),
    v_project_id,
    'carbon_project'
  );
end;
$$ language plpgsql security definer;

-- ----------------------------------------------------------------------------
-- project_documents
-- ----------------------------------------------------------------------------

create table project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carbon_projects (id) on delete cascade,
  doc_type text not null check (doc_type in ('dcp', 'resumo_calculo', 'auditoria_aprovacao', 'plano_melhorias', 'checklist', 'foto', 'outro')),
  title text not null,
  file_url text not null,
  storage_path text not null,
  uploaded_by uuid references auth.users (id),
  uploaded_by_org_id uuid references organizations (id),
  created_at timestamptz not null default now()
);

create index idx_project_documents_project on project_documents (project_id, doc_type);

alter table project_documents enable row level security;

-- developer/admin/platform_admin: qualquer doc_type.
create policy project_documents_select_full
  on project_documents for select
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]) or is_platform_admin());

create policy project_documents_insert_full
  on project_documents for insert
  to authenticated
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]) or is_platform_admin());

-- verifier: só os dois doc_type da área de auditoria/verificação.
create policy project_documents_select_verifier
  on project_documents for select
  to authenticated
  using (
    doc_type in ('auditoria_aprovacao', 'plano_melhorias')
    and has_project_role(project_id, array['verifier']::project_role[])
  );

create policy project_documents_insert_verifier
  on project_documents for insert
  to authenticated
  with check (
    doc_type in ('auditoria_aprovacao', 'plano_melhorias')
    and has_project_role(project_id, array['verifier']::project_role[])
  );

-- proponent: sem acesso a project_documents, EXCETO doc_type 'foto' (só
-- leitura) — usado na Carteira de Ativos pra mostrar fotos do projeto.
create policy project_documents_select_proponent_photos
  on project_documents for select
  to authenticated
  using (
    doc_type = 'foto'
    and has_project_role(project_id, array['proponent']::project_role[])
  );

-- ----------------------------------------------------------------------------
-- Storage: bucket privado "project-documents", convenção de path
-- {project_id}/{doc_type}/{filename}.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', false)
on conflict (id) do nothing;

create policy project_documents_storage_select_full
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and (
      has_project_role((storage.foldername(name))[1]::uuid, array['developer', 'admin']::project_role[])
      or is_platform_admin()
    )
  );

create policy project_documents_storage_insert_full
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and (
      has_project_role((storage.foldername(name))[1]::uuid, array['developer', 'admin']::project_role[])
      or is_platform_admin()
    )
  );

create policy project_documents_storage_select_verifier
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[2] in ('auditoria_aprovacao', 'plano_melhorias')
    and has_project_role((storage.foldername(name))[1]::uuid, array['verifier']::project_role[])
  );

create policy project_documents_storage_insert_verifier
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[2] in ('auditoria_aprovacao', 'plano_melhorias')
    and has_project_role((storage.foldername(name))[1]::uuid, array['verifier']::project_role[])
  );

create policy project_documents_storage_select_proponent_photos
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and (storage.foldername(name))[2] = 'foto'
    and has_project_role((storage.foldername(name))[1]::uuid, array['proponent']::project_role[])
  );

-- ----------------------------------------------------------------------------
-- carbon_projects.description — texto narrativo para a aba "Descritivo do
-- projeto". Editável só por developer/admin/platform_admin (mesma policy de
-- carbon_projects_update já existente, nenhuma policy nova necessária).
-- ----------------------------------------------------------------------------

alter table carbon_projects add column description text;
