-- ============================================================================
-- CRUD de metodologias (pedido do usuário): até aqui, metodologias só
-- existiam via seed SQL — não havia UI de criação, e a RLS só cobria
-- INSERT. Faltava:
--   1) SELECT para quem é membro da owner_org_id ver as PRÓPRIAS versões em
--      draft (methodology_versions_public_read só mostra published) — sem
--      isso, o autor nem conseguiria ver o rascunho que acabou de criar.
--   2) UPDATE em methodologies/methodology_versions/methodology_parameters
--      — não dava pra editar seções, parâmetros, nem publicar (draft ->
--      published) sem SQL manual.
--   3) DELETE em methodology_parameters, pra corrigir parâmetro errado.
-- ============================================================================

create policy methodologies_update
  on methodologies for update
  to authenticated
  using (
    exists (select 1 from org_members om where om.org_id = methodologies.owner_org_id and om.user_id = auth.uid())
    or is_platform_admin()
  )
  with check (
    exists (select 1 from org_members om where om.org_id = methodologies.owner_org_id and om.user_id = auth.uid())
    or is_platform_admin()
  );

create policy methodology_versions_owner_read
  on methodology_versions for select
  to authenticated
  using (
    exists (
      select 1 from methodologies m
      join org_members om on om.org_id = m.owner_org_id
      where m.id = methodology_versions.methodology_id and om.user_id = auth.uid()
    )
  );

create policy methodology_versions_update
  on methodology_versions for update
  to authenticated
  using (
    exists (
      select 1 from methodologies m
      join org_members om on om.org_id = m.owner_org_id
      where m.id = methodology_versions.methodology_id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  )
  with check (
    exists (
      select 1 from methodologies m
      join org_members om on om.org_id = m.owner_org_id
      where m.id = methodology_versions.methodology_id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );

create policy methodology_parameters_owner_read
  on methodology_parameters for select
  to authenticated
  using (
    exists (
      select 1 from methodology_versions mv
      join methodologies m on m.id = mv.methodology_id
      join org_members om on om.org_id = m.owner_org_id
      where mv.id = methodology_parameters.methodology_version_id and om.user_id = auth.uid()
    )
  );

create policy methodology_parameters_update
  on methodology_parameters for update
  to authenticated
  using (
    exists (
      select 1 from methodology_versions mv
      join methodologies m on m.id = mv.methodology_id
      join org_members om on om.org_id = m.owner_org_id
      where mv.id = methodology_parameters.methodology_version_id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  )
  with check (
    exists (
      select 1 from methodology_versions mv
      join methodologies m on m.id = mv.methodology_id
      join org_members om on om.org_id = m.owner_org_id
      where mv.id = methodology_parameters.methodology_version_id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );

create policy methodology_parameters_delete
  on methodology_parameters for delete
  to authenticated
  using (
    exists (
      select 1 from methodology_versions mv
      join methodologies m on m.id = mv.methodology_id
      join org_members om on om.org_id = m.owner_org_id
      where mv.id = methodology_parameters.methodology_version_id and om.user_id = auth.uid()
    )
    or is_platform_admin()
  );
