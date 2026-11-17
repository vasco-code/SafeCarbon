-- Distinção "editor vs viewer" dentro da mesma organização. org_members.
-- member_role já tem o valor 'viewer' desde o schema inicial, mas nunca teve
-- efeito real sobre permissões de projeto — has_project_role só olha
-- project_roles.role (por organização), nunca member_role (por pessoa). Isso
-- significa que hoje todo membro de uma organização proponente (ex.: Premix)
-- tem o mesmo acesso de escrita, sem forma de convidar alguém "só leitura"
-- dentro da mesma org.
--
-- has_project_write_role replica has_project_role e soma a exigência de o
-- próprio membro não ser 'viewer'. Generalizada para qualquer project_role
-- (não só proponent) — um developer/verifier convidado como viewer também
-- vira só-leitura pelo mesmo mecanismo, sem custo extra.
create or replace function has_project_write_role(p_project_id uuid, p_roles project_role[])
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1
    from project_roles pr
    join org_members om on om.org_id = pr.org_id
    where pr.project_id = p_project_id
      and om.user_id = auth.uid()
      and pr.role = any(p_roles)
      and om.member_role <> 'viewer'
  );
$$;

-- Troca has_project_role -> has_project_write_role só nas policies de
-- INSERT/UPDATE que hoje incluem 'proponent' (todo o universo, levantado por
-- grep em supabase/migrations/*.sql) — SELECT não muda em lugar nenhum.

drop policy production_records_write on production_records;
create policy production_records_write
  on production_records for insert
  to authenticated
  with check (has_project_write_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

drop policy commercialization_documents_write on commercialization_documents;
create policy commercialization_documents_write
  on commercialization_documents for insert
  to authenticated
  with check (has_project_write_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

drop policy emission_inventory_entries_write on emission_inventory_entries;
create policy emission_inventory_entries_write
  on emission_inventory_entries for insert
  to authenticated
  with check (has_project_write_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

drop policy leakage_assessments_write on leakage_assessments;
create policy leakage_assessments_write
  on leakage_assessments for insert
  to authenticated
  with check (has_project_write_role(project_id, array['proponent', 'developer', 'admin']::project_role[]));

drop policy verification_cycles_write on verification_cycles;
create policy verification_cycles_write
  on verification_cycles for insert
  to authenticated
  with check (has_project_write_role(project_id, array['proponent', 'developer', 'admin']::project_role[])
              or is_platform_admin());

drop policy verification_cycles_update on verification_cycles;
create policy verification_cycles_update
  on verification_cycles for update
  to authenticated
  using (has_project_write_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
         or is_platform_admin())
  with check (has_project_write_role(project_id, array['proponent', 'developer', 'verifier', 'admin']::project_role[])
              or is_platform_admin());

drop policy project_documents_insert_full on project_documents;
create policy project_documents_insert_full
  on project_documents for insert
  to authenticated
  with check (has_project_write_role(project_id, array['proponent', 'developer', 'admin']::project_role[]) or is_platform_admin());

drop policy project_documents_storage_insert_full on storage.objects;
create policy project_documents_storage_insert_full
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and (
      has_project_write_role((storage.foldername(name))[1]::uuid, array['proponent', 'developer', 'admin']::project_role[])
      or is_platform_admin()
    )
  );

drop policy project_status_requests_insert on project_status_requests;
create policy project_status_requests_insert
  on project_status_requests for insert
  to authenticated
  with check (
    has_project_write_role(project_id, array['proponent']::project_role[])
    and exists (
      select 1 from org_members om
      where om.org_id = requested_by_org_id and om.user_id = auth.uid()
    )
  );
