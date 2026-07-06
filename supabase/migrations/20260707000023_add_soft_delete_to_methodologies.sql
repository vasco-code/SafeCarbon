-- Adiciona soft delete e campos de rastreamento às metodologias

-- Metodologias
alter table methodologies
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id),
  add column logo_url text;

create index idx_methodologies_deleted on methodologies(deleted_at);

-- Versões de metodologias
alter table methodology_versions
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id),
  add column replicated_from_version_id uuid references methodology_versions(id);

create index idx_methodology_versions_deleted on methodology_versions(deleted_at);

-- Parâmetros de metodologias
alter table methodology_parameters
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id);

create index idx_methodology_parameters_deleted on methodology_parameters(deleted_at);

-- Atualizar policies para excluir registros soft-deleted
drop policy if exists methodology_versions_public_read on methodology_versions;
create policy methodology_versions_public_read
  on methodology_versions for select
  to public
  using (
    status = 'published'
    and deleted_at is null
    and exists (
      select 1 from methodologies m
      where m.id = methodology_versions.methodology_id
        and m.deleted_at is null
    )
  );

drop policy if exists methodology_versions_owner_read on methodology_versions;
create policy methodology_versions_owner_read
  on methodology_versions for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from methodologies m
      join org_members om on om.org_id = m.owner_org_id
      where m.id = methodology_versions.methodology_id
        and m.deleted_at is null
        and om.user_id = auth.uid()
    )
  );
