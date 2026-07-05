-- ============================================================================
-- Auditoria de CRUD (pedido do usuário): completa as permissões que faltavam
-- para operar o sistema sem depender de SQL manual — criar organização,
-- projeto, papéis de projeto, gerir membros de organização, e
-- editar/excluir os lançamentos de dado primário que hoje só tinham INSERT.
-- ============================================================================

-- organizations: criar uma nova organização é ação de quem já vai operar
-- dentro dela — em geral platform admin (Safe Trace, "registro"), mas também
-- qualquer usuário autenticado pode propor uma organização nova (ela nasce
-- sem membros, o próximo passo natural é criar o carbon_project que a usa).
create policy organizations_write
  on organizations for insert
  to authenticated
  with check (true);

-- carbon_projects: criar um projeto exige pertencer a uma das duas
-- organizações nomeadas (proponent ou developer) — nunca criar um projeto
-- "para" uma organização à qual você não pertence.
create policy carbon_projects_write
  on carbon_projects for insert
  to authenticated
  with check (
    exists (
      select 1 from org_members om
      where om.user_id = auth.uid() and om.org_id in (proponent_org_id, developer_org_id)
    )
    or is_platform_admin()
  );

create policy carbon_projects_update
  on carbon_projects for update
  to authenticated
  using (has_project_role(id, array['developer', 'admin']::project_role[]) or is_platform_admin())
  with check (has_project_role(id, array['developer', 'admin']::project_role[]) or is_platform_admin());

-- project_roles: o primeiro papel de um projeto novo é atribuído por quem
-- pertence a uma das organizações nomeadas no projeto; papéis adicionais
-- (ex.: designar um verifier depois) exigem já ser developer/admin do
-- projeto.
create policy project_roles_write
  on project_roles for insert
  to authenticated
  with check (
    exists (
      select 1 from carbon_projects cp
      join org_members om on om.org_id in (cp.proponent_org_id, cp.developer_org_id)
      where cp.id = project_id and om.user_id = auth.uid()
    )
    or has_project_role(project_id, array['developer', 'admin']::project_role[])
    or is_platform_admin()
  );

create policy project_roles_delete
  on project_roles for delete
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]) or is_platform_admin());

-- org_members: gerir os membros da própria organização (convidar via Edge
-- Function já existente com service role; aqui cobrimos mudar papel/remover
-- e adicionar um usuário já existente a outra organização).
create policy org_members_write
  on org_members for insert
  to authenticated
  with check (
    exists (
      select 1 from org_members om
      where om.org_id = org_members.org_id and om.user_id = auth.uid() and om.member_role in ('owner', 'manager')
    )
    or is_platform_admin()
  );

create policy org_members_update
  on org_members for update
  to authenticated
  using (
    exists (
      select 1 from org_members om
      where om.org_id = org_members.org_id and om.user_id = auth.uid() and om.member_role in ('owner', 'manager')
    )
    or is_platform_admin()
  )
  with check (
    exists (
      select 1 from org_members om
      where om.org_id = org_members.org_id and om.user_id = auth.uid() and om.member_role in ('owner', 'manager')
    )
    or is_platform_admin()
  );

create policy org_members_delete
  on org_members for delete
  to authenticated
  using (
    exists (
      select 1 from org_members om
      where om.org_id = org_members.org_id and om.user_id = auth.uid() and om.member_role in ('owner', 'manager')
    )
    or is_platform_admin()
  );

-- Dado primário de projeto: já tinham INSERT/SELECT (developer/admin escreve,
-- todo papel do projeto lê) — faltava DELETE/UPDATE para corrigir lançamentos
-- errados, e commercialization_documents precisa de UPDATE para os campos de
-- reconciliação (already_credited, linked_production_period_year) usados
-- pelo motor de cálculo (Fe).
create policy production_records_delete
  on production_records for delete
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy commercialization_documents_update
  on commercialization_documents for update
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]))
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy commercialization_documents_delete
  on commercialization_documents for delete
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy emission_inventory_entries_delete
  on emission_inventory_entries for delete
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy leakage_assessments_update
  on leakage_assessments for update
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]))
  with check (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy leakage_assessments_delete
  on leakage_assessments for delete
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]));

create policy project_sites_delete
  on project_sites for delete
  to authenticated
  using (has_project_role(project_id, array['developer', 'admin']::project_role[]));

-- methodologies / methodology_versions / methodology_parameters: hoje só
-- existiam via seed. Criar uma metodologia nova é ação de quem vai mantê-la
-- (owner_org_id) — mesma lógica em cascata para version e parameters.
create policy methodologies_write
  on methodologies for insert
  to authenticated
  with check (
    exists (select 1 from org_members om where om.org_id = owner_org_id and om.user_id = auth.uid())
    or is_platform_admin()
  );

create policy methodology_versions_write
  on methodology_versions for insert
  to authenticated
  with check (
    exists (
      select 1 from methodologies m
      join org_members om on om.org_id = m.owner_org_id
      where m.id = methodology_id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );

create policy methodology_parameters_write
  on methodology_parameters for insert
  to authenticated
  with check (
    exists (
      select 1 from methodology_versions mv
      join methodologies m on m.id = mv.methodology_id
      join org_members om on om.org_id = m.owner_org_id
      where mv.id = methodology_version_id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );
