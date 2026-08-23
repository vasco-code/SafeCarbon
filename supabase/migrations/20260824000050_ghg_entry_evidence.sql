-- Evidências em arquivo por lançamento da Pegada (nota fiscal, fatura,
-- foto do medidor etc.). Tabela de metadados + bucket privado de Storage,
-- mesmo padrão já usado por project-documents.
create table ghg_entry_evidence (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references ghg_activity_entries (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  uploaded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

alter table ghg_entry_evidence enable row level security;

-- Mesma função can_access_inventory já usada por ghg_activity_entries — só
-- um join a mais até a entry pra achar o inventory_id.
create policy ghg_entry_evidence_read on ghg_entry_evidence for select to authenticated
  using (exists (select 1 from ghg_activity_entries e where e.id = ghg_entry_evidence.entry_id and can_access_inventory(e.inventory_id)));
create policy ghg_entry_evidence_write on ghg_entry_evidence for insert to authenticated
  with check (exists (select 1 from ghg_activity_entries e where e.id = ghg_entry_evidence.entry_id and can_access_inventory(e.inventory_id)));
create policy ghg_entry_evidence_delete on ghg_entry_evidence for delete to authenticated
  using (exists (select 1 from ghg_activity_entries e where e.id = ghg_entry_evidence.entry_id and can_access_inventory(e.inventory_id)));

-- Bucket privado — convenção de path {entry_id}/{timestamp}-{filename}, RLS
-- lê o entry_id direto da pasta (mesma técnica de project-documents).
insert into storage.buckets (id, name, public) values ('ghg-entry-evidence', 'ghg-entry-evidence', false) on conflict (id) do nothing;

create policy ghg_entry_evidence_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'ghg-entry-evidence' and exists (
    select 1 from ghg_activity_entries e where e.id = (storage.foldername(name))[1]::uuid and can_access_inventory(e.inventory_id)
  ));
create policy ghg_entry_evidence_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ghg-entry-evidence' and exists (
    select 1 from ghg_activity_entries e where e.id = (storage.foldername(name))[1]::uuid and can_access_inventory(e.inventory_id)
  ));
create policy ghg_entry_evidence_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ghg-entry-evidence' and exists (
    select 1 from ghg_activity_entries e where e.id = (storage.foldername(name))[1]::uuid and can_access_inventory(e.inventory_id)
  ));
